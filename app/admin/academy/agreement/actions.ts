'use server';

import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';
import { getSession } from '@/lib/auth';
import type { AgreementSection } from '@/lib/learner-agreement';
import type { Prisma } from '@prisma/client';

// BLD-1731 — Learner Agreement admin management. Anyone with academy admin
// access (settings.manage) can view the current agreement read-only; editing
// and publishing are both restricted to the account OWNER, and both actions
// re-check session.role === 'OWNER' themselves — a hidden page section is
// never the only guard.
//
// The draft save is owner-gated too, not just the publish: the draft prefills
// the owner's editor, so anyone who could write a draft could put wording in
// front of the owner that a single Publish click makes the live contract.
// That is the same authority as publishing, one step removed.

function sanitizeSections(input: unknown): AgreementSection[] | null {
  if (!Array.isArray(input)) return null;
  const out: AgreementSection[] = [];
  for (const raw of input) {
    const heading = String((raw as { heading?: unknown })?.heading ?? '').trim().slice(0, 200);
    const body = String((raw as { body?: unknown })?.body ?? '').trim().slice(0, 8000);
    if (!heading || !body) continue;
    out.push({ heading, body });
  }
  return out.length ? out : null;
}

async function nextAgreementVersion(db: { learnerAgreementVersion: { count: (args: { where: Prisma.LearnerAgreementVersionWhereInput }) => Promise<number> } }): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const sameDay = await db.learnerAgreementVersion.count({ where: { version: { startsWith: today } } });
  return sameDay === 0 ? today : `${today}-${sameDay + 1}`;
}

export async function saveAgreementDraft(sections: AgreementSection[]) {
  if (!crmEnabled) return { ok: false as const, error: 'CRM disabled' };
  const session = await getSession();
  if (!session || session.role !== 'OWNER') return { ok: false as const, error: 'Only the account owner can edit the Learner Agreement.' };
  const clean = sanitizeSections(sections);
  if (!clean) return { ok: false as const, error: 'Add at least one section with a heading and body.' };

  const { db } = await import('@/lib/db');
  const draft = await db.learnerAgreementVersion.findFirst({ where: { status: 'DRAFT' }, orderBy: { updatedAt: 'desc' } });
  if (draft) {
    await db.learnerAgreementVersion.update({ where: { id: draft.id }, data: { sections: clean as unknown as Prisma.InputJsonValue } });
  } else {
    await db.learnerAgreementVersion.create({ data: { version: 'draft', sections: clean as unknown as Prisma.InputJsonValue, status: 'DRAFT', createdBy: session.email } });
  }
  revalidatePath('/admin/academy/agreement');
  return { ok: true as const };
}

export async function publishAgreement(sections: AgreementSection[]) {
  if (!crmEnabled) return { ok: false as const, error: 'CRM disabled' };
  const session = await getSession();
  if (!session || session.role !== 'OWNER') return { ok: false as const, error: 'Only the account owner can publish the Learner Agreement.' };
  const clean = sanitizeSections(sections);
  if (!clean) return { ok: false as const, error: 'Add at least one section with a heading and body.' };

  const { db } = await import('@/lib/db');
  const version = await nextAgreementVersion(db);
  await db.learnerAgreementVersion.create({
    data: { version, sections: clean as unknown as Prisma.InputJsonValue, status: 'PUBLISHED', publishedAt: new Date(), createdBy: session.email },
  });

  // The working draft is folded into what was just published — clear it so the
  // editor reopens against the new current version, not stale draft text.
  const draft = await db.learnerAgreementVersion.findFirst({ where: { status: 'DRAFT' }, orderBy: { updatedAt: 'desc' } });
  if (draft) await db.learnerAgreementVersion.delete({ where: { id: draft.id } }).catch(() => {});

  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Learner Agreement published: version ${version}` });

  // The public learn page reads getCurrentLearnerAgreement() on every request
  // (force-dynamic) so no revalidation is needed there — only the admin view.
  revalidatePath('/admin/academy/agreement');
  return { ok: true as const, version };
}
