import 'server-only';
import { getQuestionnaire, type Questionnaire, type Question } from '@/lib/questionnaires';

// BLD-209 — editable, versioned health questionnaires. The clinically-reviewed
// base lives in code (lib/questionnaires.ts); admins can publish edited versions
// which are snapshotted in the QuestionnaireVersion table. The "effective"
// definition served to clients is the highest version available (DB snapshot or
// code); a historical submission is always rendered against the version it was
// captured under, so saved answers never drift from the wording shown.

const toQuestions = (j: unknown): Question[] => (Array.isArray(j) ? (j as Question[]) : []);

function fromSnapshot(code: Questionnaire | undefined, snap: { version: number; type: string; title: string; intro: string | null; questions: unknown }): Questionnaire {
  return {
    ...(code ?? {}),
    key: code?.key ?? '',
    version: snap.version,
    type: (code?.type ?? snap.type) as Questionnaire['type'],
    title: snap.title || code?.title || '',
    intro: snap.intro ?? code?.intro ?? '',
    questions: toQuestions(snap.questions),
  } as Questionnaire;
}

/** Highest-version definition: the latest DB snapshot for the key, else code. */
export async function getEffectiveQuestionnaire(key: string): Promise<Questionnaire | undefined> {
  const code = getQuestionnaire(key);
  const { db } = await import('@/lib/db');
  const latest = await db.questionnaireVersion.findFirst({ where: { key }, orderBy: { version: 'desc' } }).catch(() => null);
  if (!latest) return code;
  // If a deploy bumped the code version above the last published snapshot, the
  // code definition wins (it's the newer clinically-reviewed baseline).
  if (code && code.version >= latest.version) return code;
  return fromSnapshot(code, latest);
}

/** The definition AS OF a given version — for rendering a historical submission. */
export async function getQuestionnaireAtVersion(key: string, version: number): Promise<Questionnaire | undefined> {
  const code = getQuestionnaire(key);
  if (code && code.version === version) return code;
  const { db } = await import('@/lib/db');
  const snap = await db.questionnaireVersion.findFirst({ where: { key, version } }).catch(() => null);
  if (snap) return fromSnapshot(code, snap);
  return code; // unknown version → current code definition (best effort)
}

/** Publish an edited question set as the next version. Returns the new version. */
export async function publishQuestionnaireVersion(
  key: string,
  edited: { title?: string; intro?: string; questions: Question[] },
  by: string | null,
): Promise<number> {
  const code = getQuestionnaire(key);
  const { db } = await import('@/lib/db');
  const latest = await db.questionnaireVersion.findFirst({ where: { key }, orderBy: { version: 'desc' } }).catch(() => null);
  const version = Math.max(code?.version ?? 1, latest?.version ?? 0) + 1;
  await db.questionnaireVersion.create({
    data: {
      key, version,
      type: code?.type ?? 'MEDICAL_HISTORY',
      title: edited.title ?? code?.title ?? key,
      intro: edited.intro ?? code?.intro ?? null,
      questions: edited.questions as unknown as object,
      createdBy: by,
    },
  });
  return version;
}
