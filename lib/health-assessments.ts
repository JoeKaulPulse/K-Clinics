import 'server-only';
import { db } from '@/lib/db';
import { encryptJson, decryptJson, integrityHash, verifyIntegrity } from '@/lib/crypto';
import { getQuestionnaire } from '@/lib/questionnaires';

/**
 * Append-only clinical store. A submission is encrypted, integrity-stamped and
 * NEVER updated/deleted. Corrections create a new version superseding the prior.
 */

export async function saveAssessment(opts: {
  clientId: string;
  questionnaireKey: string;
  answers: Record<string, unknown>;
  ip?: string | null;
  bookingId?: string | null;
}) {
  const q = getQuestionnaire(opts.questionnaireKey);
  if (!q) throw new Error('Unknown questionnaire.');

  // Find the latest prior version (for this client + type) to supersede.
  const prior = await db.healthAssessment.findFirst({
    where: { clientId: opts.clientId, type: q.type, supersedesId: null },
    orderBy: { version: 'desc' },
  });

  const cipher = encryptJson({
    questionnaire: { key: q.key, version: q.version },
    answers: opts.answers,
    capturedAt: new Date().toISOString(),
  });
  const version = (prior?.version ?? 0) + 1;
  const hash = integrityHash(cipher, {
    clientId: opts.clientId,
    type: q.type,
    version,
    questionnaireKey: `${q.key}@${q.version}`,
  });

  // Create the new immutable record; if there was a prior "current" version,
  // point its supersedesId at... we instead mark by leaving prior as historical:
  // newest row is the one whose id is not referenced by any supersedesId.
  const created = await db.healthAssessment.create({
    data: {
      clientId: opts.clientId,
      type: q.type,
      version,
      supersedesId: prior?.id ?? null,
      cipher,
      integrityHash: hash,
      questionnaireKey: `${q.key}@${q.version}`,
      summary: { complete: true, questions: q.questions.length },
      submittedIp: opts.ip ?? undefined,
      bookingId: opts.bookingId ?? undefined,
    },
  });
  return { id: created.id, version };
}

/** Non-clinical status for the portal dashboard (no answers decrypted). */
export async function assessmentStatus(clientId: string) {
  const rows = await db.healthAssessment.findMany({
    where: { clientId },
    select: { type: true, version: true, submittedAt: true, questionnaireKey: true },
    orderBy: { submittedAt: 'desc' },
  });
  const latestByType = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!latestByType.has(r.type)) latestByType.set(r.type, r);
  return latestByType;
}

/** Decrypt + format an assessment for clinical display (caller MUST authorise). */
export async function formatAssessment(id: string) {
  const a = await readAssessment(id);
  if (!a) return null;
  const key = (a.questionnaire?.key as string) || a.questionnaireKey.split('@')[0];
  const def = getQuestionnaire(key);
  const answers = (a.answers || {}) as Record<string, unknown>;
  const items = (def?.questions ?? []).map((q) => {
    const raw = answers[q.id];
    let value = '—';
    if (raw !== undefined && raw !== '' && raw !== null) {
      if (q.options && (q.type === 'single' || q.type === 'boolean')) {
        value = q.options.find((o) => o.value === raw)?.label ?? String(raw);
      } else if (q.type === 'multi' && Array.isArray(raw)) {
        value = raw.map((v) => q.options?.find((o) => o.value === v)?.label ?? v).join(', ');
      } else {
        value = String(raw);
      }
    }
    return { id: q.id, prompt: q.prompt, value };
  }).filter((it) => it.value !== '—');
  return { title: def?.title ?? key, version: a.version, submittedAt: a.submittedAt, tampered: a.tampered, items };
}

/** Decrypt a single assessment — clinical access only (caller must authorise). */
export async function readAssessment(id: string) {
  const row = await db.healthAssessment.findUnique({ where: { id } });
  if (!row) return null;
  const ok = verifyIntegrity(row.cipher, {
    clientId: row.clientId,
    type: row.type,
    version: row.version,
    questionnaireKey: row.questionnaireKey,
  }, row.integrityHash);
  const data = decryptJson<{ answers: Record<string, unknown>; questionnaire: { key: string; version: number } }>(
    row.cipher,
  );
  return { ...row, tampered: !ok, ...data };
}
