import 'server-only';
import { db } from '@/lib/db';
import type { Question, Questionnaire, FieldType } from '@/lib/questionnaires';

// BLD-190 — admin-managed EXTRA questions, merged onto a code-defined health form.
// The clinically-reviewed base questions stay versioned in code; these add-ons are
// appended at render (client portal) and at clinician display. Answer keys are
// namespaced `cq_<id>` so they never collide with base question ids.

const FIELD_TYPES: FieldType[] = ['single', 'multi', 'boolean', 'text', 'longtext', 'scale', 'date', 'signature'];
export const isFieldType = (s: string): s is FieldType => (FIELD_TYPES as string[]).includes(s);
export const customAnswerKey = (id: string) => `cq_${id}`;

/** Active add-on questions for a questionnaire, mapped to the render shape. */
export async function customQuestionsFor(key: string): Promise<Question[]> {
  const rows = await db.formQuestion
    .findMany({ where: { questionnaireKey: key, active: true }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] })
    .catch(() => []);
  return rows.map((r) => {
    const opts = Array.isArray(r.options) ? (r.options as { value: string; label: string }[]) : undefined;
    return {
      id: customAnswerKey(r.id),
      type: (isFieldType(r.fieldType) ? r.fieldType : 'text') as FieldType,
      prompt: r.prompt,
      help: r.help ?? undefined,
      required: r.required,
      options: opts,
    } satisfies Question;
  });
}

/** A questionnaire with its admin-managed add-on questions appended. */
export async function withCustomQuestions(q: Questionnaire): Promise<Questionnaire> {
  const extra = await customQuestionsFor(q.key);
  return extra.length ? { ...q, questions: [...q.questions, ...extra] } : q;
}
