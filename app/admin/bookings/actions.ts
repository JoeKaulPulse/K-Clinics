'use server';

import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';
import { getSession } from '@/lib/auth';

// Staff: charge the saved card for a delivered service (adjustable amount).
export async function chargeBookingAction(bookingId: string, amountPence: number) {
  if (!crmEnabled) return { ok: false, error: 'CRM disabled' };
  const session = await getSession();
  if (!session) return { ok: false, error: 'Unauthorised' };
  if (!Number.isFinite(amountPence) || amountPence < 0) return { ok: false, error: 'Invalid amount' };

  const { db } = await import('@/lib/db');
  const { chargeBooking } = await import('@/lib/booking-actions');
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { client: true } });
  if (!booking) return { ok: false, error: 'Not found' };
  if (booking.chargedAt) return { ok: false, error: 'Already charged' };

  const res = await chargeBooking(booking, Math.round(amountPence), { late: false });
  if (res.ok) {
    await db.interaction.create({ data: { clientId: booking.clientId, type: 'APPOINTMENT', summary: `Charged £${(amountPence / 100).toFixed(2)} for ${booking.treatmentTitle}`, author: session.email } });
  }
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath('/admin/bookings');
  return res.ok ? { ok: true } : { ok: false, error: res.requiresAction ? 'Card needs authentication — client emailed a confirm link.' : res.error };
}

export async function setBookingStatus(bookingId: string, status: 'COMPLETED' | 'NO_SHOW' | 'CONFIRMED') {
  if (!crmEnabled) return;
  const session = await getSession();
  if (!session) return;
  const { db } = await import('@/lib/db');
  await db.booking.update({ where: { id: bookingId }, data: { status } });
  const b = await db.booking.findUnique({ where: { id: bookingId } });
  if (b) {
    await db.interaction.create({ data: { clientId: b.clientId, type: 'APPOINTMENT', summary: `Booking marked ${status.toLowerCase().replace('_', ' ')}`, author: session.email } });
    if (status === 'COMPLETED') await db.client.update({ where: { id: b.clientId }, data: { lastVisitAt: new Date() } });
  }
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath('/admin/bookings');
}

// Staff cancel with optional fee waiver (override of the within-24h charge).
export async function cancelBookingAction(bookingId: string, opts: { reason?: string; waiveFee?: boolean }) {
  if (!crmEnabled) return { ok: false, error: 'CRM disabled' };
  const session = await getSession();
  if (!session) return { ok: false, error: 'Unauthorised' };
  const { cancelBooking } = await import('@/lib/booking-actions');
  const res = await cancelBooking(bookingId, { by: session.email, reason: opts.reason, waiveFee: opts.waiveFee });
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath('/admin/bookings');
  return res;
}
