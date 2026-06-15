'use server';

import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan } from '@/lib/auth';

// PRJ-63 — contractor task actions. Managers (contractor.tasks.manage) create &
// assign; the assignee (or a manager) updates status. No client/clinical data.

export async function createContractorTask(input: { title: string; description?: string; assigneeId?: string; dueAt?: string; locationId?: string }) {
  if (!crmEnabled) return { ok: false, error: 'CRM disabled' };
  const session = await getSession();
  if (!session || !sessionCan(session, 'contractor.tasks.manage')) return { ok: false, error: 'Not permitted' };
  const title = (input.title || '').trim();
  if (!title) return { ok: false, error: 'Give the task a title.' };
  const { db } = await import('@/lib/db');
  const task = await db.contractorTask.create({
    data: {
      title: title.slice(0, 200),
      description: (input.description || '').trim().slice(0, 2000) || null,
      assigneeId: input.assigneeId || null,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      locationId: input.locationId || null,
      createdBy: session.email,
    },
    select: { id: true, assigneeId: true },
  });
  // BLD-285: notify the assignee so they see the task in their notification bell.
  if (task.assigneeId) {
    const { notifyStaffById } = await import('@/lib/notifications');
    await notifyStaffById(task.assigneeId, {
      kind: 'assigned',
      title: `New task assigned: ${title.slice(0, 100)}`,
      body: input.description?.trim().slice(0, 200) || undefined,
      href: '/admin/contractors',
    }, session.sub);
  }
  revalidatePath('/admin');
  revalidatePath('/admin/my-day');
  return { ok: true };
}

export async function setContractorTaskStatus(taskId: string, status: 'OPEN' | 'IN_PROGRESS' | 'DONE') {
  if (!crmEnabled) return { ok: false, error: 'CRM disabled' };
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not signed in.' };
  const { db } = await import('@/lib/db');
  const task = await db.contractorTask.findUnique({ where: { id: taskId }, select: { assigneeId: true } });
  if (!task) return { ok: false, error: 'Task not found.' };
  // The assignee may update their own task; managers may update any.
  const isOwn = task.assigneeId === session.sub;
  if (!isOwn && !sessionCan(session, 'contractor.tasks.manage')) return { ok: false, error: 'Not permitted' };
  await db.contractorTask.update({
    where: { id: taskId },
    data: { status, completedAt: status === 'DONE' ? new Date() : null },
  });
  revalidatePath('/admin');
  return { ok: true };
}
