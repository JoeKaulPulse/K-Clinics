'use server';

import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan } from '@/lib/auth';

// PRJ-63 — admin management of contractor profiles + on-site visits. All actions
// are gated on the existing `contractor.tasks.manage` permission. No new
// permission key is introduced. These touch only Contractor/ContractorVisit
// rows — never client/clinical/financial data, and never any auth account.

const PERM = 'contractor.tasks.manage';

async function guard() {
  if (!crmEnabled) return null;
  const session = await getSession();
  if (!session || !sessionCan(session, PERM)) return null;
  return session;
}

export async function approveContractor(id: string) {
  const session = await guard();
  if (!session) return { ok: false, error: 'Not permitted' };
  const { db } = await import('@/lib/db');
  await db.contractor.update({
    where: { id: String(id || '') },
    data: { status: 'APPROVED', approvedAt: new Date(), approvedBy: session.email },
  }).catch(() => {});
  revalidatePath('/admin/contractors');
  return { ok: true };
}

export async function blockContractor(id: string) {
  const session = await guard();
  if (!session) return { ok: false, error: 'Not permitted' };
  const { db } = await import('@/lib/db');
  const cid = String(id || '');
  // Block the profile AND close any open visit so a blocked contractor is logged
  // out of the on-site view immediately.
  await db.contractor.update({ where: { id: cid }, data: { status: 'BLOCKED' } }).catch(() => {});
  await db.contractorVisit.updateMany({
    where: { contractorId: cid, checkedOutAt: null },
    data: { checkedOutAt: new Date() },
  }).catch(() => {});
  revalidatePath('/admin/contractors');
  return { ok: true };
}

export async function unblockContractor(id: string) {
  const session = await guard();
  if (!session) return { ok: false, error: 'Not permitted' };
  const { db } = await import('@/lib/db');
  // Unblocking returns to APPROVED (an admin has now vetted them).
  await db.contractor.update({
    where: { id: String(id || '') },
    data: { status: 'APPROVED', approvedAt: new Date(), approvedBy: session.email },
  }).catch(() => {});
  revalidatePath('/admin/contractors');
  return { ok: true };
}

export async function setContractorNote(id: string, note: string) {
  const session = await guard();
  if (!session) return { ok: false, error: 'Not permitted' };
  const { db } = await import('@/lib/db');
  await db.contractor.update({
    where: { id: String(id || '') },
    data: { note: String(note || '').trim().slice(0, 2000) || null },
  }).catch(() => {});
  revalidatePath('/admin/contractors');
  return { ok: true };
}

export async function forceCheckOut(visitId: string) {
  const session = await guard();
  if (!session) return { ok: false, error: 'Not permitted' };
  const { db } = await import('@/lib/db');
  await db.contractorVisit.update({
    where: { id: String(visitId || '') },
    data: { checkedOutAt: new Date() },
  }).catch(() => {});
  revalidatePath('/admin/contractors');
  return { ok: true };
}
