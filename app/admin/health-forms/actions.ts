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
  const options = needsOptions ? parseOptions(input.optionsText || '') : null;
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
