'use server';

import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, canViewClinical } from '@/lib/auth';

const NOTE_TYPES = ['NOTE', 'CLINICAL', 'COMPLAINT', 'FOLLOW_UP', 'CALL'] as const;

export async function addNote(clientId: string, summary: string, type: string = 'NOTE', detail?: string, pinned?: boolean) {
  if (!crmEnabled || !summary.trim()) return;
  const session = await getSession();
  if (!session || !sessionCan(session, 'clients.edit')) return;
  const t = (NOTE_TYPES as readonly string[]).includes(type) ? type : 'NOTE';
  // Clinical notes are restricted to clinical staff.
  if (t === 'CLINICAL' && !canViewClinical(session.role)) return;
  const { db } = await import('@/lib/db');
  const note = await db.interaction.create({
    data: { clientId, type: t as never, summary: summary.trim(), detail: detail?.trim() || null, author: session.email, pinned: Boolean(pinned) },
  });
  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'NOTE_ADDED', actor: session.email, actorRole: session.role, clientId, summary: `${t.toLowerCase()} note added`, meta: { noteId: note.id } });
  revalidatePath(`/admin/clients/${clientId}`);
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

export async function togglePinNote(noteId: string, clientId: string, pinned: boolean) {
  if (!crmEnabled) return;
  const session = await getSession();
  if (!session || !sessionCan(session, 'clients.edit')) return;
  const { db } = await import('@/lib/db');
  await db.interaction.update({ where: { id: noteId }, data: { pinned } });
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function setConsultStatus(consultId: string, clientId: string, status: string) {
  if (!crmEnabled) return;
  const session = await getSession();
  if (!session || !sessionCan(session, 'consultations.manage')) return;
  const { db } = await import('@/lib/db');
  await db.consultation.update({ where: { id: consultId }, data: { status: status as never } });
  await db.interaction.create({
    data: { clientId, type: 'SYSTEM', summary: `Status changed to ${status}`, author: session.email },
  });
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath('/admin/consultations');
}

export async function sendManualEmail(clientId: string, to: string, subject: string, body: string) {
  if (!crmEnabled || !subject.trim() || !body.trim()) return { ok: false, error: 'Subject and body required' };
  const session = await getSession();
  if (!session || !sessionCan(session, 'clients.view')) return { ok: false, error: 'Unauthorised' };
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
