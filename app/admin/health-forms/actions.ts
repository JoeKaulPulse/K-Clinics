'use server';

import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan } from '@/lib/auth';
import { getQuestionnaire } from '@/lib/questionnaires';
import { isFieldType } from '@/lib/health-forms';

// BLD-190 — manage EXTRA (add-on) questions on a health form. Owner/admin only.
// The clinically-reviewed base questions are not touched here.

async function guard() {
  if (!crmEnabled) return { error: 'CRM disabled' as const };
  const session = await getSession();
  if (!session || !sessionCan(session, 'settings.manage')) return { error: 'Not permitted' as const };
  return { session };
}

function parseOptions(raw: string): { value: string; label: string }[] {
  // One option per line, "value|Label" or just "Label" (value derived).
  return raw.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 24).map((line) => {
    const [a, b] = line.split('|').map((s) => s.trim());
    const label = (b || a);
    const value = (b ? a : a.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')) || label;
    return { value, label };
  });
}

export async function addCustomQuestion(input: { questionnaireKey: string; prompt: string; fieldType: string; help?: string; required?: boolean; optionsText?: string }) {
  const g = await guard(); if ('error' in g) return { ok: false, error: g.error };
  const key = String(input.questionnaireKey || '');
  if (!getQuestionnaire(key)) return { ok: false, error: 'Unknown form.' };
  const prompt = (input.prompt || '').trim();
  if (!prompt) return { ok: false, error: 'Enter the question wording.' };
  const fieldType = isFieldType(input.fieldType) ? input.fieldType : 'text';
  const needsOptions = fieldType === 'single' || fieldType === 'multi';
  // BLD-405: boolean always gets built-in Yes/No options so the AssessmentRunner
  // Field component never receives a boolean question with null options.
  const options = fieldType === 'boolean'
    ? [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]
    : needsOptions ? parseOptions(input.optionsText || '') : null;
  if (needsOptions && (!options || options.length < 2)) return { ok: false, error: 'Add at least two options (one per line).' };

  const { db } = await import('@/lib/db');
  const last = await db.formQuestion.findFirst({ where: { questionnaireKey: key }, orderBy: { order: 'desc' }, select: { order: true } });
  await db.formQuestion.create({
    data: {
      questionnaireKey: key,
      prompt: prompt.slice(0, 400),
      fieldType,
      help: (input.help || '').trim().slice(0, 300) || null,
      required: !!input.required,
      options: options ?? undefined,
      order: (last?.order ?? 0) + 1,
      createdBy: g.session.email,
    },
  });
  revalidatePath('/admin/health-forms');
  return { ok: true };
}

export async function setCustomQuestionActive(id: string, active: boolean) {
  const g = await guard(); if ('error' in g) return { ok: false, error: g.error };
  const { db } = await import('@/lib/db');
  await db.formQuestion.update({ where: { id }, data: { active } }).catch(() => {});
  revalidatePath('/admin/health-forms');
  return { ok: true };
}

export async function deleteCustomQuestion(id: string) {
  const g = await guard(); if ('error' in g) return { ok: false, error: g.error };
  const { db } = await import('@/lib/db');
  await db.formQuestion.delete({ where: { id } }).catch(() => {});
  revalidatePath('/admin/health-forms');
  return { ok: true };
}

export async function moveCustomQuestion(id: string, dir: 'up' | 'down') {
  const g = await guard(); if ('error' in g) return { ok: false, error: g.error };
  const { db } = await import('@/lib/db');
  const q = await db.formQuestion.findUnique({ where: { id } });
  if (!q) return { ok: false, error: 'Not found.' };
  const neighbour = await db.formQuestion.findFirst({
    where: { questionnaireKey: q.questionnaireKey, order: dir === 'up' ? { lt: q.order } : { gt: q.order } },
    orderBy: { order: dir === 'up' ? 'desc' : 'asc' },
  });
  if (!neighbour) return { ok: true };
  await db.$transaction([
    db.formQuestion.update({ where: { id: q.id }, data: { order: neighbour.order } }),
    db.formQuestion.update({ where: { id: neighbour.id }, data: { order: q.order } }),
  ]).catch(() => {});
  revalidatePath('/admin/health-forms');
  return { ok: true };
}

// BLD-209 — edit the CORE questions of a health form. Publishing snapshots the
// edited set as a new immutable version (lib/questionnaire-versions.ts); past
// submissions keep rendering against the version they were captured under.
export async function publishCoreQuestions(input: {
  questionnaireKey: string;
  questions: { id: string; prompt: string; required?: boolean; type: string; options?: { value: string; label: string }[]; help?: string; showIf?: unknown }[];
}) {
  const g = await guard(); if ('error' in g) return { ok: false as const, error: g.error };
  const key = String(input.questionnaireKey || '');
  const code = getQuestionnaire(key);
  if (!code) return { ok: false as const, error: 'Unknown form.' };
  const questions = (input.questions || [])
    .map((q) => ({ ...q, prompt: (q.prompt || '').trim() }))
    .filter((q) => q.id && q.prompt);
  if (questions.length === 0) return { ok: false as const, error: 'Keep at least one question.' };
  const { publishQuestionnaireVersion } = await import('@/lib/questionnaire-versions');
  const version = await publishQuestionnaireVersion(key, { questions: questions as never }, g.session.email);
  try {
    const { logAudit } = await import('@/lib/audit');
    await logAudit({ action: 'SETTINGS_UPDATED', actor: g.session.email, actorRole: g.session.role, summary: `Health form “${key}” edited — published v${version} (${questions.length} questions)`, meta: { key, version } });
  } catch { /* non-fatal */ }
  revalidatePath('/admin/health-forms');
  return { ok: true as const, version };
}
