'use server';

import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, canViewClinical } from '@/lib/auth';

const NOTE_TYPES = ['NOTE', 'CLINICAL', 'COMPLAINT', 'FOLLOW_UP', 'CALL'] as const;

export async function addNote(clientId: string, summary: string, type: string = 'NOTE', detail?: string, pinned?: boolean): Promise<{ ok: boolean; error?: string }> {
  if (!crmEnabled || !summary.trim()) return { ok: false, error: 'Nothing to save.' };
  const session = await getSession();
  if (!session || !sessionCan(session, 'clients.edit')) return { ok: false, error: 'You don’t have permission to add notes.' };
  const t = (NOTE_TYPES as readonly string[]).includes(type) ? type : 'NOTE';
  // Clinical notes are restricted to clinical staff.
  if (t === 'CLINICAL' && !canViewClinical(session.role)) return { ok: false, error: 'Clinical notes are restricted to clinical staff.' };
  const { db } = await import('@/lib/db');
  const note = await db.interaction.create({
    data: { clientId, type: t as never, summary: summary.trim(), detail: detail?.trim() || null, author: session.email, pinned: Boolean(pinned) },
  });
  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'NOTE_ADDED', actor: session.email, actorRole: session.role, clientId, summary: `${t.toLowerCase()} note added`, meta: { noteId: note.id } });
  revalidatePath(`/admin/clients/${clientId}`);
  return { ok: true };
}

// GDPR right-to-erasure — pseudonymise a client's personal data while keeping
// financial/audit records intact for legal retention. Requires clients.export.
export async function eraseClientData(clientId: string) {
  if (!crmEnabled) return { ok: false };
  const session = await getSession();
  if (!session || !sessionCan(session, 'clients.export')) return { ok: false, error: 'Not permitted' };
  const { db } = await import('@/lib/db');
  const { logAudit } = await import('@/lib/audit');
  await db.client.update({
    where: { id: clientId },
    data: {
      firstName: 'Erased', lastName: null, email: `erased-${clientId}@redacted.invalid`,
      phone: null, dob: null, notes: null, medicalFlag: null, medicalFlagSetBy: null, medicalFlagAt: null,
      marketingOptIn: false, unsubscribed: true, portalActive: false, passwordHash: null,
      resetTokenHash: null, resetTokenExp: null,
    },
  });
  // Remove free-text interactions that may contain personal data.
  await db.interaction.deleteMany({ where: { clientId } });
  await logAudit({ action: 'NOTE_ADDED', actor: session.email, actorRole: session.role, clientId, summary: 'Client personal data erased (GDPR right-to-erasure)' });
  revalidatePath(`/admin/clients/${clientId}`);
  return { ok: true };
}

/** Permanently delete a client and ALL related records (irreversible).
 *  Guard-railed: requires the `clients.delete` permission AND a typed "DELETE"
 *  confirmation. The audit entry survives (AuditEvent.clientId is not an FK). */
export async function deleteClient(clientId: string, confirm: string) {
  if (!crmEnabled) return { ok: false, error: 'Unavailable.' };
  const session = await getSession();
  if (!session || !sessionCan(session, 'clients.delete')) return { ok: false, error: 'Not permitted.' };
  if (confirm !== 'DELETE') return { ok: false, error: 'Type DELETE to confirm.' };

  const { db } = await import('@/lib/db');
  const { logAudit } = await import('@/lib/audit');

  const c = await db.client.findUnique({ where: { id: clientId }, select: { firstName: true, lastName: true, email: true } });
  if (!c) return { ok: false, error: 'Client not found.' };

  try {
    // Cascades to the client's bookings, assessments, points, reviews, etc.
    await db.client.delete({ where: { id: clientId } });
  } catch (e) {
    return { ok: false, error: (e as Error)?.message || 'Could not delete this client.' };
  }

  // Log AFTER deletion so the record persists; no personal data in the summary.
  await logAudit({
    action: 'CLIENT_DELETED',
    actor: session.email,
    actorRole: session.role,
    clientId,
    summary: 'Client permanently deleted (right to erasure)',
    meta: { email: c.email },
  });
  revalidatePath('/admin/clients');
  return { ok: true };
}

export async function togglePinNote(noteId: string, clientId: string, pinned: boolean) {
  if (!crmEnabled) return;
  const session = await getSession();
  if (!session || !sessionCan(session, 'clients.edit')) return;
  const { db } = await import('@/lib/db');
  await db.interaction.update({ where: { id: noteId }, data: { pinned } });
  revalidatePath(`/admin/clients/${clientId}`);
}

const CONSULT_STATUSES = ['NEW', 'CONTACTED', 'BOOKED', 'COMPLETED', 'CLOSED'];

export async function setConsultStatus(consultId: string, clientId: string, status: string): Promise<{ ok: boolean; error?: string }> {
  if (!crmEnabled) return { ok: false, error: 'Unavailable.' };
  const session = await getSession();
  if (!session || !sessionCan(session, 'consultations.manage')) return { ok: false, error: 'You don’t have permission to change consultation status.' };
  if (!CONSULT_STATUSES.includes(status)) return { ok: false, error: 'Invalid status.' };
  const { db } = await import('@/lib/db');
  try {
    await db.consultation.update({ where: { id: consultId }, data: { status: status as never } });
  } catch {
    return { ok: false, error: 'Could not update the consultation.' };
  }
  await db.interaction.create({
    data: { clientId, type: 'SYSTEM', summary: `Status changed to ${status}`, author: session.email },
  });
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath('/admin/consultations');
  return { ok: true };
}

export async function sendManualEmail(clientId: string, to: string, subject: string, body: string) {
  if (!crmEnabled || !subject.trim() || !body.trim()) return { ok: false, error: 'Subject and body required' };
  const session = await getSession();
  if (!session || !sessionCan(session, 'clients.edit')) return { ok: false, error: 'You don’t have permission to email clients.' };
  const { db } = await import('@/lib/db');
  const { sendEmail, tmplManual } = await import('@/lib/email');

  const client = await db.client.findUnique({ where: { id: clientId } });
  const unsubUrl = client ? `${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/unsubscribe?t=${client.unsubToken}` : undefined;

  const res = await sendEmail({ to, subject, html: tmplManual(body.replace(/\n/g, '<br>'), unsubUrl) });
  await db.emailEvent.create({
    data: { clientId, kind: 'MANUAL', to, subject, status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error },
  });
  if (res.ok) {
    await db.interaction.create({ data: { clientId, type: 'EMAIL', summary: `Email sent: ${subject}`, author: session.email } });
  }
  revalidatePath(`/admin/clients/${clientId}`);
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

export async function toggleMarketing(clientId: string, optIn: boolean) {
  if (!crmEnabled) return;
  const session = await getSession();
  if (!session || !sessionCan(session, 'clients.edit')) return;
  const { db } = await import('@/lib/db');
  await db.client.update({ where: { id: clientId }, data: { marketingOptIn: optIn, unsubscribed: optIn ? false : undefined } });
  revalidatePath(`/admin/clients/${clientId}`);
}
