import 'server-only';
import { db } from '@/lib/db';
import { encryptJson, decryptJson, integrityHash, verifyIntegrity } from '@/lib/crypto';
import { getEffectiveQuestionnaire, getQuestionnaireAtVersion } from '@/lib/questionnaire-versions';

/**
 * Append-only clinical store. A submission is encrypted, integrity-stamped and
 * NEVER updated/deleted. Corrections create a new version superseding the prior.
 */

export async function saveAssessment(opts: {
  clientId: string;
  questionnaireKey: string;
  answers: Record<string, unknown>;
  sourceLocale?: string;
  ip?: string | null;
  bookingId?: string | null;
}) {
  // Use the effective (latest published) version so a submission is captured
  // against the current wording and records key@version for later resolution.
  const q = await getEffectiveQuestionnaire(opts.questionnaireKey);
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
      sourceLocale: opts.sourceLocale === 'uk' ? 'uk' : 'en',
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
  // Resolve the questionnaire AS OF the version this answer was captured under, so
  // historical forms always render with the exact wording the client saw (BLD-209).
  const capturedVersion = Number(a.questionnaireKey.split('@')[1]);
  const def = await getQuestionnaireAtVersion(key, capturedVersion);
  const answers = (a.answers || {}) as Record<string, unknown>;
  const sourceLocale = (a as { sourceLocale?: string }).sourceLocale || 'en';

  // Include any admin-managed extra questions (BLD-190) so their answers display.
  const { customQuestionsFor } = await import('@/lib/health-forms');
  const allQuestions = [...(def?.questions ?? []), ...(await customQuestionsFor(key))];

  const items: { id: string; prompt: string; value: string; freeText: boolean; original?: string }[] =
    allQuestions.map((q) => {
      const raw = answers[q.id];
      let value = '—';
      let freeText = false;
      if (raw !== undefined && raw !== '' && raw !== null) {
        if (q.options && (q.type === 'single' || q.type === 'boolean')) {
          value = q.options.find((o) => o.value === raw)?.label ?? String(raw);
        } else if (q.type === 'multi' && Array.isArray(raw)) {
          value = raw.map((v) => q.options?.find((o) => o.value === v)?.label ?? v).join(', ');
        } else {
          value = String(raw);
          freeText = true;
        }
      }
      return { id: q.id, prompt: q.prompt, value, freeText };
    }).filter((it) => it.value !== '—');

  // Free-text answers are stored exactly as the client typed them. When that
  // wasn't English, translate to British English for staff; keep the original.
  let translatedNote: string | null = null;
  if (sourceLocale !== 'en') {
    const { translateToEnglish, localeName, translationConfigured } = await import('@/lib/translate');
    const freeIdx = items.map((it, i) => (it.freeText ? i : -1)).filter((i) => i >= 0);
    if (freeIdx.length > 0) {
      const { translated, ok } = await translateToEnglish(freeIdx.map((i) => items[i].value));
      if (ok) {
        freeIdx.forEach((i, k) => { items[i].original = items[i].value; items[i].value = translated[k]; });
        translatedNote = `Translated from ${localeName(sourceLocale)}`;
      } else {
        translatedNote = translationConfigured()
          ? `Filled in ${localeName(sourceLocale)} — translation temporarily unavailable`
          : `Filled in ${localeName(sourceLocale)} — translation not configured`;
      }
    }
  }

  return { title: def?.title ?? key, version: a.version, submittedAt: a.submittedAt, tampered: a.tampered, sourceLocale, translatedNote, items };
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
