import 'server-only';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { activeKeyId, retiredKeyIds, encryptJson, decryptJson, integrityHash, bytesKeyId, encryptBytes, decryptBytes } from '@/lib/crypto';
import { encClinical, decClinical } from '@/lib/clinical-crypto';

// Safe, idempotent re-encryption of records still on a retired key, onto the
// current active key. Old keys stay in the ring so data is always readable — so
// this is pure hygiene: it lets you eventually remove a retired (e.g. compromised)
// key once nothing references it. Runs in batches from the daily cron.
//
// BLD-1180: this sweep previously tracked only 4 columns while encClinical/
// encryptJson write to ~25 across the codebase — following the documented
// runbook ("remove the old key once the sweep reports 0 remaining") would have
// silently and permanently destroyed the special-category data still sitting on
// the retired key in the untracked columns. Every encrypted column is now in
// the registry below, and the sweep matches ONLY blobs whose keyId prefix is a
// RETIRED ring key — never plaintext. That matters for the encClinical columns,
// which legally hold legacy plaintext (decClinical tolerates it): the separate
// clinical-encryption backfill owns upgrading plaintext; this sweep's single
// job is moving ciphertext off retired keys, so its "0 remaining" is a truthful
// key-removal gate.
//
// Known exclusion: CallRecord.raw is a Json column that lib/yay.ts writes as an
// encClinical string. Prisma cannot prefix-filter Json, so it is re-keyed by the
// bespoke pass at the bottom (fetch-then-test), not the registry.

/** Where-clause matching blobs written by any RETIRED ring key. Empty when no
 *  rotation is in progress (only the active key is loaded). */
function staleWhere(field: string): { OR: Record<string, { startsWith: string }>[] } | null {
  const retired = retiredKeyIds();
  if (!retired.length) return null;
  return { OR: retired.map((id) => ({ [field]: { startsWith: `${id}.` } })) };
}

/** Is this stored value a keyring blob on a retired key? (client-side check for
 *  columns Prisma can't prefix-filter). */
function onRetiredKey(v: string): boolean {
  const parts = v.split('.');
  return parts.length === 4 && retiredKeyIds().includes(parts[0]);
}

// ── The registry ─────────────────────────────────────────────────────────────
// kind 'json'     → strict encryptJson blob: reEnc = encryptJson(decryptJson(v))
// kind 'clinical' → encClinical column:      reEnc = encClinical(decClinical(v))
//                   (identical result for ciphertext; used so a decrypt surprise
//                   degrades the same way reads do instead of throwing).
// Bespoke integrity-hashed models (HealthAssessment, SignedConsent) are handled
// separately below — their hash binds the cipher to metadata and must be
// recomputed with the new blob.
type SweepEntry = { model: string; label: string; field: string; pk?: string; kind: 'json' | 'clinical' };
const SWEEP: SweepEntry[] = [
  // strict encryptJson blobs
  { model: 'booking', label: 'clinicalNotes', field: 'clinicalNoteEnc', kind: 'json' },
  { model: 'booking', label: 'sopChecklists', field: 'sopChecklistEnc', kind: 'json' },
  { model: 'externalConnection', label: 'oauthTokens', field: 'tokensEnc', kind: 'json' },
  { model: 'aiAnalysis', label: 'aiFindings', field: 'findingsEnc', kind: 'json' },
  { model: 'aiAnalysisImage', label: 'aiImages', field: 'dataEnc', kind: 'json' },
  { model: 'beforePhoto', label: 'beforePhotos', field: 'dataEnc', kind: 'json' },
  { model: 'managedSecret', label: 'managedSecrets', field: 'valueEnc', pk: 'name', kind: 'json' },
  { model: 'adminUser', label: 'totpSecrets', field: 'totpSecret', kind: 'json' },
  { model: 'adminUser', label: 'googleRefreshTokens', field: 'googleRefreshToken', kind: 'json' },
  // encClinical columns (may also hold legacy plaintext — never matched here)
  { model: 'client', label: 'clientMedicalFlags', field: 'medicalFlag', kind: 'clinical' },
  { model: 'client', label: 'clientAllergies', field: 'allergies', kind: 'clinical' },
  { model: 'consultation', label: 'consultationConcerns', field: 'concerns', kind: 'clinical' },
  { model: 'consultation', label: 'consultationMessages', field: 'message', kind: 'clinical' },
  { model: 'consultation', label: 'consultationMedicalNotes', field: 'medicalNotes', kind: 'clinical' },
  { model: 'booking', label: 'bookingAllergyNotes', field: 'allergyNote', kind: 'clinical' },
  { model: 'consultationNote', label: 'consultationNotes', field: 'body', kind: 'clinical' },
  { model: 'chatMessage', label: 'chatMessages', field: 'body', kind: 'clinical' },
  { model: 'interaction', label: 'interactionDetails', field: 'detail', kind: 'clinical' },
  { model: 'task', label: 'taskDetails', field: 'detail', kind: 'clinical' },
  { model: 'followUp', label: 'followUpComments', field: 'comment', kind: 'clinical' },
  { model: 'incident', label: 'incidentDescriptions', field: 'descriptionEnc', kind: 'clinical' },
  { model: 'callRecord', label: 'callNotes', field: 'notes', kind: 'clinical' },
  { model: 'callRecord', label: 'callTranscripts', field: 'transcript', kind: 'clinical' },
  { model: 'callRecord', label: 'callRecordings', field: 'recordingUrl', kind: 'clinical' },
];

// Loosely-typed model access for the registry loop. Every entry above is a real
// delegate + string column; the scoped-query CI check and tsc keep the schema
// honest, and one bad entry fails that record's `safe()` without aborting the batch.
type Delegate = {
  count: (args: { where: unknown }) => Promise<number>;
  findMany: (args: { where: unknown; take: number; select: Record<string, boolean> }) => Promise<Record<string, unknown>[]>;
  update: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<unknown>;
};
const delegate = (model: string): Delegate => (db as unknown as Record<string, Delegate>)[model];

export type RotationStatus = {
  activeKeyId: string;
  pending: Record<string, number>;
  total: number;
};

export async function rotationStatus(): Promise<RotationStatus> {
  const pending: Record<string, number> = {};
  const retired = retiredKeyIds();
  if (!retired.length) return { activeKeyId: activeKeyId(), pending, total: 0 };

  for (const e of SWEEP) {
    const where = staleWhere(e.field);
    if (!where) continue;
    const n = await delegate(e.model).count({ where }).catch(() => 0);
    pending[e.label] = (pending[e.label] || 0) + n;
  }
  // Integrity-hashed models
  pending.healthAssessments = await db.healthAssessment.count({ where: staleWhere('cipher')! }).catch(() => 0);
  pending.signedConsents = await db.signedConsent.count({ where: staleWhere('cipher')! }).catch(() => 0);
  // GalleryItem before/after — Bytes columns (BLD-1041). Prisma can't
  // prefix-filter Bytes, so scan and test client-side; the table is small
  // (published cases), and plaintext rows (bytesKeyId null — the backfill's
  // job, not this sweep's) never count.
  pending.galleryPhotos = 0;
  const gIds = await db.galleryItem.findMany({ select: { id: true } }).catch(() => [] as { id: string }[]);
  for (const { id } of gIds) {
    const g = await db.galleryItem.findUnique({ where: { id }, select: { beforeImage: true, afterImage: true } }).catch(() => null);
    if (!g) continue;
    const b = bytesKeyId(g.beforeImage), a = bytesKeyId(g.afterImage);
    if ((b && retired.includes(b)) || (a && retired.includes(a))) pending.galleryPhotos++;
  }

  const total = Object.values(pending).reduce((s, n) => s + n, 0);
  return { activeKeyId: activeKeyId(), pending, total };
}

const reEncJson = (blob: string) => encryptJson(decryptJson(blob));
// A blob the ring can't decrypt comes back UNCHANGED from decClinical (its
// plaintext tolerance) — re-encrypting that would double-wrap ciphertext and
// make reads return gibberish. Treat it as a per-record error instead; the row
// stays on the stale count where a human can see it.
const reEncClinical = (blob: string) => {
  const dec = decClinical(blob);
  if (dec === blob) throw new Error('blob not decryptable by the ring — skipped to avoid double-encryption');
  return encClinical(dec) as string;
};

/**
 * Re-encrypt up to `limit` records (across all encrypted columns) onto the
 * active key. Returns how many were migrated and how many remain. Each record
 * is isolated — one failure never aborts the batch.
 */
export async function reencryptBatch(limit = 300): Promise<{ migrated: number; remaining: number; errors: number }> {
  let budget = limit;
  let migrated = 0;
  let errors = 0;
  const safe = async (fn: () => Promise<void>) => { try { await fn(); migrated++; } catch (e) { errors++; console.error('[key-rotation] record failed:', (e as Error)?.message); } };

  if (!retiredKeyIds().length) return { migrated: 0, remaining: 0, errors: 0 };

  // HealthAssessment — integrity hash binds cipher to metadata; recompute.
  if (budget > 0) {
    const rows = await db.healthAssessment.findMany({ where: staleWhere('cipher')!, take: budget, select: { id: true, cipher: true, clientId: true, type: true, version: true, questionnaireKey: true } });
    for (const r of rows) {
      await safe(async () => {
        const cipher = reEncJson(r.cipher);
        const hash = integrityHash(cipher, { clientId: r.clientId, type: r.type, version: r.version, questionnaireKey: r.questionnaireKey });
        await db.healthAssessment.update({ where: { id: r.id }, data: { cipher, integrityHash: hash } });
      });
    }
    budget -= rows.length;
  }

  // SignedConsent — same integrity-hash coupling (BLD-1180; see lib/consent.ts).
  if (budget > 0) {
    const rows = await db.signedConsent.findMany({ where: staleWhere('cipher')!, take: budget, select: { id: true, cipher: true, clientId: true, templateKey: true, contentHash: true } });
    for (const r of rows) {
      await safe(async () => {
        const cipher = reEncJson(r.cipher);
        const ih = integrityHash(cipher, { clientId: r.clientId, templateKey: r.templateKey, contentHash: r.contentHash });
        await db.signedConsent.update({ where: { id: r.id }, data: { cipher, integrityHash: ih } });
      });
    }
    budget -= rows.length;
  }

  // Registry columns.
  for (const e of SWEEP) {
    if (budget <= 0) break;
    const where = staleWhere(e.field);
    if (!where) break;
    const pk = e.pk || 'id';
    const rows = await delegate(e.model).findMany({ where, take: budget, select: { [pk]: true, [e.field]: true } }).catch(() => [] as Record<string, unknown>[]);
    for (const r of rows) {
      await safe(async () => {
        const v = r[e.field] as string;
        const next = e.kind === 'json' ? reEncJson(v) : reEncClinical(v);
        await delegate(e.model).update({ where: { [pk]: r[pk] }, data: { [e.field]: next } });
      });
    }
    budget -= rows.length;
  }

  // GalleryItem before/after — Bytes columns (BLD-1041), tested client-side
  // like CallRecord.raw below. Only re-keys sides whose blob is on a RETIRED
  // key; plaintext (bytesKeyId null) is the encryption backfill's job.
  if (budget > 0) {
    const retired = retiredKeyIds();
    const gIds = await db.galleryItem.findMany({ select: { id: true } }).catch(() => [] as { id: string }[]);
    for (const { id } of gIds) {
      if (budget <= 0) break;
      const g = await db.galleryItem.findUnique({ where: { id }, select: { beforeImage: true, afterImage: true } }).catch(() => null);
      if (!g) continue;
      const bId = bytesKeyId(g.beforeImage), aId = bytesKeyId(g.afterImage);
      const staleBefore = !!bId && retired.includes(bId);
      const staleAfter = !!aId && retired.includes(aId);
      if (!staleBefore && !staleAfter) continue;
      budget--;
      // Re-encryption happens INSIDE safe() so an undecryptable blob (decryptBytes
      // throws) fails this record only, never the batch.
      await safe(async () => {
        const data: Record<string, Uint8Array<ArrayBuffer>> = {};
        if (staleBefore) data.beforeImage = encryptBytes(decryptBytes(g.beforeImage));
        if (staleAfter) data.afterImage = encryptBytes(decryptBytes(g.afterImage));
        await db.galleryItem.update({ where: { id }, data });
      });
    }
  }

  // CallRecord.raw — Json column holding an encClinical string (lib/yay.ts);
  // Prisma can't prefix-filter Json, so fetch candidates and test client-side.
  if (budget > 0) {
    const rows = await db.callRecord.findMany({ where: { NOT: { raw: { equals: Prisma.DbNull } } }, take: budget * 3, select: { id: true, raw: true } }).catch(() => []);
    for (const r of rows) {
      if (budget <= 0) break;
      if (typeof r.raw !== 'string' || !onRetiredKey(r.raw)) continue;
      budget--;
      await safe(async () => { await db.callRecord.update({ where: { id: r.id }, data: { raw: reEncClinical(r.raw as string) } }); });
    }
  }

  const remaining = (await rotationStatus()).total;
  return { migrated, remaining, errors };
}

/** Only run the sweep when a rotation is actually in progress (retired keys
 *  present) or when explicitly enabled — avoids churning legacy data otherwise. */
export function rotationActive(): boolean {
  return !!process.env.HEALTH_ENCRYPTION_KEYS_OLD?.trim() || process.env.HEALTH_KEY_REENCRYPT === 'true';
}
