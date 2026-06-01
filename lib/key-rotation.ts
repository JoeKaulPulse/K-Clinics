import 'server-only';
import { db } from '@/lib/db';
import { activeKeyId, encryptJson, decryptJson, integrityHash } from '@/lib/crypto';

// Safe, idempotent re-encryption of records still on a retired key, onto the
// current active key. Old keys stay in the ring so data is always readable — so
// this is pure hygiene: it lets you eventually remove a retired (e.g. compromised)
// key once nothing references it. Runs in batches from the daily cron.

// Records NOT written by the active key (legacy un-tagged blobs are matched too,
// since they don't start with the active key id).
const stale = () => ({ not: { startsWith: `${activeKeyId()}.` } });

export type RotationStatus = {
  activeKeyId: string;
  pending: { healthAssessments: number; clinicalNotes: number; sopChecklists: number; oauthTokens: number };
  total: number;
};

export async function rotationStatus(): Promise<RotationStatus> {
  const s = stale();
  const [healthAssessments, clinicalNotes, sopChecklists, oauthTokens] = await Promise.all([
    db.healthAssessment.count({ where: { cipher: s } }),
    db.booking.count({ where: { clinicalNoteEnc: s } }),
    db.booking.count({ where: { sopChecklistEnc: s } }),
    db.externalConnection.count({ where: { tokensEnc: s } }),
  ]);
  const pending = { healthAssessments, clinicalNotes, sopChecklists, oauthTokens };
  return { activeKeyId: activeKeyId(), pending, total: healthAssessments + clinicalNotes + sopChecklists + oauthTokens };
}

const reEnc = (blob: string) => encryptJson(decryptJson(blob));

/**
 * Re-encrypt up to `limit` records (across all encrypted columns) onto the
 * active key. Returns how many were migrated and how many remain. Each record
 * is isolated — one failure never aborts the batch.
 */
export async function reencryptBatch(limit = 300): Promise<{ migrated: number; remaining: number; errors: number }> {
  const s = stale();
  let budget = limit;
  let migrated = 0;
  let errors = 0;
  const safe = async (fn: () => Promise<void>) => { try { await fn(); migrated++; } catch (e) { errors++; console.error('[key-rotation] record failed:', (e as Error)?.message); } };

  // Health assessments — re-encrypt AND recompute the integrity HMAC.
  if (budget > 0) {
    const rows = await db.healthAssessment.findMany({ where: { cipher: s }, take: budget, select: { id: true, cipher: true, clientId: true, type: true, version: true, questionnaireKey: true } });
    for (const r of rows) {
      await safe(async () => {
        const cipher = reEnc(r.cipher);
        const hash = integrityHash(cipher, { clientId: r.clientId, type: r.type, version: r.version, questionnaireKey: r.questionnaireKey });
        await db.healthAssessment.update({ where: { id: r.id }, data: { cipher, integrityHash: hash } });
      });
    }
    budget -= rows.length;
  }

  if (budget > 0) {
    const rows = await db.booking.findMany({ where: { clinicalNoteEnc: s }, take: budget, select: { id: true, clinicalNoteEnc: true } });
    for (const r of rows) await safe(async () => { await db.booking.update({ where: { id: r.id }, data: { clinicalNoteEnc: reEnc(r.clinicalNoteEnc!) } }); });
    budget -= rows.length;
  }

  if (budget > 0) {
    const rows = await db.booking.findMany({ where: { sopChecklistEnc: s }, take: budget, select: { id: true, sopChecklistEnc: true } });
    for (const r of rows) await safe(async () => { await db.booking.update({ where: { id: r.id }, data: { sopChecklistEnc: reEnc(r.sopChecklistEnc!) } }); });
    budget -= rows.length;
  }

  if (budget > 0) {
    const rows = await db.externalConnection.findMany({ where: { tokensEnc: s }, take: budget, select: { id: true, tokensEnc: true } });
    for (const r of rows) await safe(async () => { await db.externalConnection.update({ where: { id: r.id }, data: { tokensEnc: reEnc(r.tokensEnc) } }); });
    budget -= rows.length;
  }

  const remaining = (await rotationStatus()).total;
  return { migrated, remaining, errors };
}

/** Only run the sweep when a rotation is actually in progress (retired keys
 *  present) or when explicitly enabled — avoids churning legacy data otherwise. */
export function rotationActive(): boolean {
  return !!process.env.HEALTH_ENCRYPTION_KEYS_OLD?.trim() || process.env.HEALTH_KEY_REENCRYPT === 'true';
}
