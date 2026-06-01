'use server';

import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan } from '@/lib/auth';

// Set which location an appointment takes place at (multi-location).
export async function setBookingLocation(bookingId: string, locationId: string | null) {
  if (!crmEnabled) return { ok: false };
  const session = await getSession();
  if (!session || !sessionCan(session, 'bookings.manage')) return { ok: false, error: 'Not permitted' };
  const { db } = await import('@/lib/db');
  await db.booking.update({ where: { id: bookingId }, data: { locationId: locationId || null } });
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { ok: true };
}

// Staff: charge the saved card for a delivered service (adjustable amount).
export async function chargeBookingAction(bookingId: string, amountPence: number) {
  if (!crmEnabled) return { ok: false, error: 'CRM disabled' };
  const session = await getSession();
  if (!session) return { ok: false, error: 'Unauthorised' };
  if (!sessionCan(session, 'bookings.charge')) return { ok: false, error: 'You don’t have permission to take payments.' };
  if (!Number.isFinite(amountPence) || amountPence < 0) return { ok: false, error: 'Invalid amount' };

  const { db } = await import('@/lib/db');
  const { chargeBooking } = await import('@/lib/booking-actions');
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { client: true } });
  if (!booking) return { ok: false, error: 'Not found' };
  if (booking.chargedAt) return { ok: false, error: 'Already charged' };

  const res = await chargeBooking(booking, Math.round(amountPence), { late: false });
  const { logAudit } = await import('@/lib/audit');
  if (res.ok) {
    await db.interaction.create({ data: { clientId: booking.clientId, type: 'APPOINTMENT', summary: `Charged £${(amountPence / 100).toFixed(2)} for ${booking.treatmentTitle}`, author: session.email } });
    await logAudit({ action: 'PAYMENT_CHARGED', actor: session.email, actorRole: session.role, bookingId, clientId: booking.clientId, summary: `Charged £${(amountPence / 100).toFixed(2)}` });
    // The charged amount is the truest spend signal — credit loyalty points
    // (idempotent: a no-op if completion already awarded them).
    try {
      const { awardClientSpend } = await import('@/lib/client-loyalty');
      await awardClientSpend(bookingId);
    } catch (e) {
      console.error('[bookings] loyalty on charge failed:', (e as Error)?.message);
    }
  } else {
    await logAudit({ action: 'PAYMENT_FAILED', actor: session.email, actorRole: session.role, bookingId, clientId: booking.clientId, summary: `Charge failed: ${res.error || 'unknown'}` });
  }
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath('/admin/bookings');
  return res.ok ? { ok: true } : { ok: false, error: res.requiresAction ? 'Card needs authentication — client emailed a confirm link.' : res.error };
}

export async function setBookingStatus(bookingId: string, status: 'COMPLETED' | 'NO_SHOW' | 'CONFIRMED') {
  if (!crmEnabled) return;
  const session = await getSession();
  if (!session || !sessionCan(session, 'bookings.manage')) return;
  const { db } = await import('@/lib/db');
  await db.booking.update({ where: { id: bookingId }, data: { status } });
  const b = await db.booking.findUnique({ where: { id: bookingId } });
  if (b) {
    await db.interaction.create({ data: { clientId: b.clientId, type: 'APPOINTMENT', summary: `Booking marked ${status.toLowerCase().replace('_', ' ')}`, author: session.email } });
    if (status === 'COMPLETED') {
      await db.client.update({ where: { id: b.clientId }, data: { lastVisitAt: new Date() } });

      // Completing an appointment closes two loops, neither on the critical path:
      // (1) award the practitioner efficiency / low-waste points, and
      // (2) ask the client for a review (if enabled in settings).
      try {
        const { awardForCompletedAppointment } = await import('@/lib/gamification');
        await awardForCompletedAppointment(bookingId);
      } catch (e) {
        console.error('[bookings] gamification on complete failed:', (e as Error)?.message);
      }
      // (3) credit the client their loyalty points (idempotent; also fires when
      // the booking is later charged, whichever happens first).
      try {
        const { awardClientSpend } = await import('@/lib/client-loyalty');
        await awardClientSpend(bookingId);
      } catch (e) {
        console.error('[bookings] loyalty on complete failed:', (e as Error)?.message);
      }
      try {
        const { getSetting } = await import('@/lib/settings');
        if (await getSetting('review_requests_enabled')) {
          const { ensureReviewRequest, sendReviewRequest } = await import('@/lib/review-system');
          const review = await ensureReviewRequest(bookingId);
          // Send once only: `channel` is null until the first request goes out.
          if (review && review.status === 'PENDING' && !review.channel) {
            await sendReviewRequest(review.id, 'EMAIL');
          }
        }
      } catch (e) {
        console.error('[bookings] review request on complete failed:', (e as Error)?.message);
      }
    }
  }
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath('/admin/bookings');
}

// Staff cancel with optional fee waiver (override of the within-24h charge).
export async function cancelBookingAction(bookingId: string, opts: { reason?: string; waiveFee?: boolean }) {
  if (!crmEnabled) return { ok: false, error: 'CRM disabled' };
  const session = await getSession();
  if (!session) return { ok: false, error: 'Unauthorised' };
  if (!sessionCan(session, 'bookings.manage')) return { ok: false, error: 'You don’t have permission to manage bookings.' };
  const { cancelBooking } = await import('@/lib/booking-actions');
  const res = await cancelBooking(bookingId, { by: session.email, reason: opts.reason, waiveFee: opts.waiveFee });
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath('/admin/bookings');
  return res;
}
