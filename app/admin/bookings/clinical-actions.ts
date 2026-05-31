'use server';

import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan } from '@/lib/auth';

// Clinician confirms they've reviewed the SOP for this appointment.
export async function acknowledgeSop(bookingId: string) {
  if (!crmEnabled) return { ok: false };
  const session = await getSession();
  if (!session || !sessionCan(session, 'bookings.manage')) return { ok: false, error: 'Not permitted' };
  const { db } = await import('@/lib/db');
  const { logAudit } = await import('@/lib/audit');
  await db.booking.update({ where: { id: bookingId }, data: { sopAcknowledgedAt: new Date(), sopAcknowledgedBy: session.email } });
  await logAudit({ action: 'SOP_ACKNOWLEDGED', actor: session.email, actorRole: session.role, bookingId, summary: 'SOP reviewed & acknowledged' });
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { ok: true };
}

// Clinician confirms they've reviewed the client's medical flag.
export async function reviewMedicalFlag(bookingId: string) {
  if (!crmEnabled) return { ok: false };
  const session = await getSession();
  if (!session || !sessionCan(session, 'bookings.manage')) return { ok: false, error: 'Not permitted' };
  const { db } = await import('@/lib/db');
  const { logAudit } = await import('@/lib/audit');
  const b = await db.booking.update({ where: { id: bookingId }, data: { medicalFlagReviewedAt: new Date(), medicalFlagReviewedBy: session.email } });
  await logAudit({ action: 'MEDICAL_FLAG_REVIEWED', actor: session.email, actorRole: session.role, bookingId, clientId: b.clientId, summary: 'Client medical flag reviewed' });
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { ok: true };
}

// Start the appointment clock — gated by required pre-checks.
export async function startAppointment(bookingId: string) {
  if (!crmEnabled) return { ok: false };
  const session = await getSession();
  if (!session || !sessionCan(session, 'bookings.manage')) return { ok: false, error: 'Not permitted' };

  const { db } = await import('@/lib/db');
  const { getSetting } = await import('@/lib/settings');
  const { logAudit } = await import('@/lib/audit');

  const b = await db.booking.findUnique({ where: { id: bookingId }, include: { client: { select: { medicalFlag: true } } } });
  if (!b) return { ok: false, error: 'Not found' };

  // Enforce pre-checks.
  if ((await getSetting('require_sop_ack')) && !b.sopAcknowledgedAt) {
    return { ok: false, error: 'Please acknowledge the treatment SOP before starting.' };
  }
  if ((await getSetting('require_medical_review')) && b.client.medicalFlag && !b.medicalFlagReviewedAt) {
    return { ok: false, error: 'Please review the client’s medical flag before starting.' };
  }

  await db.booking.update({ where: { id: bookingId }, data: { startedAt: new Date() } });
  await logAudit({ action: 'APPOINTMENT_STARTED', actor: session.email, actorRole: session.role, bookingId, clientId: b.clientId, summary: 'Appointment started (clock running)' });
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { ok: true };
}

// Finish the appointment — stamps actual duration and marks COMPLETED.
export async function finishAppointment(bookingId: string) {
  if (!crmEnabled) return { ok: false };
  const session = await getSession();
  if (!session || !sessionCan(session, 'bookings.manage')) return { ok: false, error: 'Not permitted' };
  const { db } = await import('@/lib/db');
  const { logAudit } = await import('@/lib/audit');
  const b = await db.booking.findUnique({ where: { id: bookingId } });
  if (!b) return { ok: false, error: 'Not found' };
  const finishedAt = new Date();
  const actualMinutes = b.startedAt ? Math.max(1, Math.round((finishedAt.getTime() - b.startedAt.getTime()) / 60000)) : null;
  await db.booking.update({ where: { id: bookingId }, data: { finishedAt, actualMinutes, status: 'COMPLETED' } });
  await db.client.update({ where: { id: b.clientId }, data: { lastVisitAt: finishedAt } });
  await logAudit({ action: 'APPOINTMENT_COMPLETED', actor: session.email, actorRole: session.role, bookingId, clientId: b.clientId, summary: `Appointment completed${actualMinutes ? ` (${actualMinutes} min actual vs ${b.durationMin} booked)` : ''}` });
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { ok: true, actualMinutes };
}
