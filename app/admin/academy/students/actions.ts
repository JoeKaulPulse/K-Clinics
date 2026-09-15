'use server';

import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan } from '@/lib/auth';

// BLD-1732 — admin-only edit of a trainee's first/last name. Email stays
// locked (never editable here, and there is no self-service edit path in the
// learner's own academy portal account). Gated by the same permission key
// already used for every other write in the academy admin area, mirroring
// editClient's pattern for the clinic CRM.

export async function editStudent(studentId: string, input: { firstName?: string; lastName?: string }) {
  if (!crmEnabled) return { ok: false as const, error: 'CRM disabled' };
  const session = await getSession();
  if (!session || !sessionCan(session, 'settings.manage')) return { ok: false as const, error: 'You don’t have permission to edit trainees.' };

  const { db } = await import('@/lib/db');
  const current = await db.academyStudent.findUnique({ where: { id: studentId }, select: { firstName: true, lastName: true } });
  if (!current) return { ok: false as const, error: 'Trainee not found.' };

  const data: Record<string, unknown> = {};
  const changes: { field: string; from: string; to: string }[] = [];

  if (input.firstName !== undefined) {
    const to = String(input.firstName).trim();
    if (!to) return { ok: false as const, error: 'First name is required.' };
    if (to !== current.firstName) { data.firstName = to; changes.push({ field: 'firstName', from: current.firstName, to }); }
  }
  if (input.lastName !== undefined) {
    const to = String(input.lastName).trim() || null;
    const from = current.lastName ?? null;
    if (to !== from) { data.lastName = to; changes.push({ field: 'lastName', from: from ?? '—', to: to ?? '—' }); }
  }

  if (changes.length === 0) return { ok: true as const, changed: 0 };

  await db.academyStudent.update({ where: { id: studentId }, data });

  const { logAudit } = await import('@/lib/audit');
  await logAudit({
    action: 'STUDENT_EDITED',
    actor: session.email,
    actorRole: session.role,
    summary: `Edited trainee name: ${changes.map((c) => c.field).join(', ')}`,
    meta: { studentId, changes },
  });

  revalidatePath(`/admin/academy/students/${studentId}`);
  return { ok: true as const, changed: changes.length };
}
