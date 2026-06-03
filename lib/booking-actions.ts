import 'server-only';
import { db } from './db';
import { stripe } from './stripe';
import { site } from './site';
import {
  sendEmail,
  tmplBookingCancelled,
  tmplChargeReceipt,
  tmplPaymentActionRequired,
} from './email';
import { logAudit } from './audit';
import type { Booking, Client } from '@prisma/client';

const CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000;

type BookingWithClient = Booking & { client: Client };

export function isWithin24h(b: Pick<Booking, 'startAt'>): boolean {
  return b.startAt.getTime() - Date.now() < CANCEL_WINDOW_MS;
}

/**
 * Charge the saved card off-session. Handles SCA: if the bank requires action,
 * the booking is left flagged and the client is emailed a confirm link.
 * Returns { ok, requiresAction?, error? }.
 */
export async function chargeBooking(
  booking: BookingWithClient,
  amountPence: number,
  opts: { late?: boolean } = {},
): Promise<{ ok: boolean; requiresAction?: boolean; error?: string }> {
  if (amountPence <= 0) return { ok: true }; // nothing to charge (on-consultation £0)
  if (!booking.stripeCustomerId || !booking.stripePaymentMethodId) {
    return { ok: false, error: 'No saved card for this booking.' };
  }

  try {
    const pi = await stripe().paymentIntents.create({
      amount: amountPence,
      currency: 'gbp',
      customer: booking.stripeCustomerId,
      payment_method: booking.stripePaymentMethodId,
      off_session: true,
      confirm: true,
      description: `${opts.late ? 'Late cancellation' : 'Treatment'} — ${booking.treatmentTitle}`,
      metadata: { bookingId: booking.id, late: String(Boolean(opts.late)) },
    });

    if (pi.status === 'succeeded') {
      await db.booking.update({
        where: { id: booking.id },
        data: { chargePaymentIntentId: pi.id, chargedPence: amountPence, chargedAt: new Date() },
      });
      await db.emailEvent.create({ data: { clientId: booking.clientId, kind: 'MANUAL', to: booking.client.email, subject: 'Payment receipt', status: 'SENT' } });
      await sendEmail({
        to: booking.client.email,
        subject: opts.late ? 'Late-cancellation fee — KClinics' : `Receipt — ${booking.treatmentTitle}`,
        html: tmplChargeReceipt({ firstName: booking.client.firstName, treatment: booking.treatmentTitle, pricePence: amountPence, late: opts.late }),
      });
      return { ok: true };
    }
    return { ok: false, error: `Payment status: ${pi.status}` };
  } catch (e: unknown) {
    // SCA / authentication required → email the client a secure confirm link.
    const err = e as { code?: string; raw?: { payment_intent?: { id: string; client_secret: string } } };
    if (err.code === 'authentication_required' && err.raw?.payment_intent) {
      const payUrl = `${process.env.NEXT_PUBLIC_SITE_URL || site.url}/booking/pay?pi=${err.raw.payment_intent.client_secret}`;
      await db.booking.update({ where: { id: booking.id }, data: { chargePaymentIntentId: err.raw.payment_intent.id } });
      await sendEmail({
        to: booking.client.email,
        subject: 'Action needed to complete your payment — KClinics',
        html: tmplPaymentActionRequired({ firstName: booking.client.firstName, treatment: booking.treatmentTitle, payUrl, pricePence: amountPence }),
      });
      return { ok: false, requiresAction: true, error: 'Card needs authentication; client emailed.' };
    }
    return { ok: false, error: e instanceof Error ? e.message : 'Charge failed' };
  }
}

/**
 * Cancel a booking, applying the 24-hour policy.
 * - >24h before: free.
 * - <24h before: charge 100% (the late fee), unless `waiveFee` is set.
 */
export async function cancelBooking(
  bookingId: string,
  opts: { by: string; reason?: string; waiveFee?: boolean },
): Promise<{ ok: boolean; charged?: number; requiresAction?: boolean; feeFailed?: boolean; error?: string }> {
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { client: true } });
  if (!booking) return { ok: false, error: 'Booking not found' };
  if (['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(booking.status)) {
    return { ok: false, error: 'This booking can no longer be cancelled.' };
  }

  const late = isWithin24h(booking);
  const shouldCharge = late && !opts.waiveFee && booking.pricePence > 0;
  let charged = 0;
  let requiresAction = false;
  let feeFailed = false;

  if (shouldCharge) {
    const res = await chargeBooking(booking, booking.pricePence, { late: true });
    if (res.ok) charged = booking.pricePence;
    else if (res.requiresAction) requiresAction = true;
    else feeFailed = true; // charge declined — cancel anyway, but flag for follow-up.
  }

  await db.booking.update({
    where: { id: booking.id },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelReason: opts.reason || null,
      cancelledBy: opts.by,
      lateCancel: late,
      feeWaived: late && opts.waiveFee ? true : false,
    },
  });
  await db.interaction.create({
    data: { clientId: booking.clientId, type: 'APPOINTMENT', summary: `Cancelled ${booking.treatmentTitle}${late ? ' (within 24h)' : ''}${charged ? ` — charged £${(charged / 100).toFixed(2)}` : feeFailed ? ' — LATE FEE FAILED (follow up)' : opts.waiveFee && late ? ' — fee waived' : ''}`, author: opts.by },
  });
  if (feeFailed) {
    await logAudit({ action: 'PAYMENT_FAILED', actor: opts.by, bookingId: booking.id, clientId: booking.clientId, summary: `Late-cancellation fee (£${(booking.pricePence / 100).toFixed(2)}) failed — follow up.` }).catch(() => {});
  }

  // Remove from the shared clinic calendar (Hostinger CalDAV; no-op if unconfigured).
  import('@/lib/hostinger-calendar').then((m) => m.removeBooking(booking.id)).catch(() => {});

  // Return any loyalty points the client had applied to this booking.
  try {
    const { refundBookingPoints } = await import('@/lib/client-loyalty');
    await refundBookingPoints(booking.id);
  } catch (e) {
    console.error('[cancelBooking] points refund failed (continuing):', (e as Error)?.message);
  }

  // Cancellation email (free vs late-fee).
  await sendEmail({
    to: booking.client.email,
    subject: `Booking cancelled — ${booking.treatmentTitle}`,
    html: tmplBookingCancelled({ firstName: booking.client.firstName, treatment: booking.treatmentTitle, start: booking.startAt, feeCharged: charged || undefined }),
  });

  return { ok: true, charged, requiresAction, feeFailed };
}
