import 'server-only';
import { db } from './db';
import { stripe } from './stripe';
import { site } from './site';
import {
  sendEmail,
  tmplBookingCancelled,
  tmplBookingRescheduled,
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
      // VAT breakdown on the receipt once the clinic is VAT-registered (dormant otherwise).
      let vat: { netPence: number; vatPence: number; ratePct: number } | null = null;
      try {
        const { getVatConfig, effectiveVatClass, vatBreakdown } = await import('@/lib/vat');
        const cfg = await getVatConfig();
        if (cfg.registered) {
          const { getServiceByTreatment } = await import('@/lib/services');
          const svc = await getServiceByTreatment(booking.treatmentSlug);
          const b = vatBreakdown(amountPence, cfg, effectiveVatClass({ vatClass: svc?.vatClass, category: svc?.category }));
          if (b.applied) vat = { netPence: b.netPence, vatPence: b.vatPence, ratePct: b.ratePct };
        }
      } catch { /* receipt still sends without the VAT line */ }
      await sendEmail({
        to: booking.client.email,
        subject: opts.late ? 'Late-cancellation fee — KClinics' : `Receipt — ${booking.treatmentTitle}`,
        html: tmplChargeReceipt({ firstName: booking.client.firstName, treatment: booking.treatmentTitle, pricePence: amountPence, late: opts.late, vat }),
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

// Refunds may be issued for up to 180 days after the charge (Stripe's limit, and
// a sensible "standard timeframe after the appointment" for a clinic service).
export const REFUND_WINDOW_DAYS = 180;
export const REFUND_WINDOW_MS = REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export function refundableUntil(b: Pick<Booking, 'chargedAt'>): Date | null {
  return b.chargedAt ? new Date(b.chargedAt.getTime() + REFUND_WINDOW_MS) : null;
}
/** Remaining refundable amount on a booking (charged minus already refunded). */
export function refundableRemaining(b: Pick<Booking, 'chargedPence' | 'refundedPence'>): number {
  return Math.max(0, (b.chargedPence ?? 0) - (b.refundedPence ?? 0));
}

/**
 * Refund a charged booking (full or partial) via Stripe, within the allowed
 * window. Idempotency is provided by Stripe (refunding more than remaining
 * fails); we then persist the cumulative refunded amount + reason and reverse
 * loyalty points on a full refund.
 */
export async function refundBooking(
  booking: BookingWithClient,
  amountPence: number,
  opts: { reason?: string; actor?: string } = {},
): Promise<{ ok: boolean; error?: string; refundedPence?: number }> {
  if (!booking.chargedAt || !booking.chargePaymentIntentId) return { ok: false, error: 'This booking hasn’t been charged, so there’s nothing to refund.' };
  const { getConfigNumber } = await import('@/lib/settings');
  const windowDays = await getConfigNumber('refund_window_days');
  const until = new Date(booking.chargedAt.getTime() + windowDays * 24 * 60 * 60 * 1000);
  if (Date.now() > until.getTime()) return { ok: false, error: `The ${windowDays}-day refund window for this payment has passed. Refund it directly in Stripe if still possible.` };
  const remaining = refundableRemaining(booking);
  const amount = Math.round(amountPence);
  if (!(amount > 0)) return { ok: false, error: 'Enter an amount to refund.' };
  if (amount > remaining) return { ok: false, error: `Only ${(remaining / 100).toFixed(2)} is left to refund on this booking.` };

  try {
    await stripe().refunds.create({
      payment_intent: booking.chargePaymentIntentId,
      amount,
      metadata: { bookingId: booking.id, reason: (opts.reason || '').slice(0, 200) },
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Refund failed at Stripe.' };
  }

  const totalRefunded = (booking.refundedPence ?? 0) + amount;
  const fully = totalRefunded >= (booking.chargedPence ?? 0);
  await db.booking.update({
    where: { id: booking.id },
    data: { refundedPence: totalRefunded, refundedAt: new Date(), refundReason: opts.reason?.slice(0, 500) || booking.refundReason || null },
  });

  // Reverse loyalty points once the booking is fully refunded (best-effort).
  if (fully) {
    try { const { refundBookingPoints } = await import('@/lib/client-loyalty'); await refundBookingPoints(booking.id); } catch { /* non-fatal */ }
  }

  await db.interaction.create({ data: { clientId: booking.clientId, type: 'APPOINTMENT', summary: `Refunded £${(amount / 100).toFixed(2)} for ${booking.treatmentTitle}${opts.reason ? ` — ${opts.reason}` : ''}`, author: opts.actor || 'system' } }).catch(() => {});
  await logAudit({ action: 'PAYMENT_REFUNDED', actor: opts.actor || 'system', bookingId: booking.id, clientId: booking.clientId, summary: `Refunded £${(amount / 100).toFixed(2)}${fully ? ' (full)' : ' (partial)'}`, meta: { amountPence: amount, fully } }).catch(() => {});

  try {
    const { tmplRefund } = await import('./email');
    await sendEmail({ to: booking.client.email, subject: `Refund processed — ${booking.treatmentTitle}`, html: tmplRefund({ firstName: booking.client.firstName, treatment: booking.treatmentTitle, amountPence: amount, fully }) });
  } catch { /* email best-effort */ }

  // Net the refund out of ad/analytics ROAS (GA4 refund event), best-effort.
  try { const { sendRefund } = await import('@/lib/conversions'); await sendRefund({ bookingId: booking.id, valuePence: amount, clientId: booking.clientId }); } catch { /* non-fatal */ }

  return { ok: true, refundedPence: totalRefunded };
}

/**
 * Idempotently record a SUCCESSFUL booking charge: mark the booking charged,
 * email a receipt, credit loyalty and report the sale. Safe to call more than
 * once (and from more than one place — the Stripe webhook and the SCA recovery
 * flow both call it) because the `chargedAt: null` guard means only the first
 * call does anything. Returns true if THIS call finalised it.
 */
export async function finalizeBookingCharge(
  bookingId: string,
  piId: string,
  amountReceivedPence: number,
  opts: { late?: boolean } = {},
): Promise<boolean> {
  const updated = await db.booking.updateMany({
    where: { id: bookingId, chargedAt: null },
    data: { chargePaymentIntentId: piId, chargedPence: amountReceivedPence, chargedAt: new Date() },
  });
  if (updated.count === 0) return false; // already finalised elsewhere — no-op

  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { client: true } });
  if (!booking) return true;

  try {
    await sendEmail({
      to: booking.client.email,
      subject: opts.late ? 'Late-cancellation fee — KClinics' : `Receipt — ${booking.treatmentTitle}`,
      html: tmplChargeReceipt({ firstName: booking.client.firstName, treatment: booking.treatmentTitle, pricePence: amountReceivedPence, late: opts.late }),
    });
    await db.emailEvent.create({ data: { clientId: booking.clientId, kind: 'MANUAL', to: booking.client.email, subject: 'Payment receipt', status: 'SENT' } });
  } catch (e) { console.error('[charge] receipt failed:', (e as Error)?.message); }
  try { const { awardClientSpend } = await import('./client-loyalty'); await awardClientSpend(bookingId); } catch (e) { console.error('[charge] loyalty failed:', (e as Error)?.message); }
  try { const { sendPurchase } = await import('./conversions'); await sendPurchase({ bookingId, valuePence: amountReceivedPence, clientId: booking.clientId, email: booking.client.email, campaign: booking.attribCampaign }); } catch (e) { console.error('[charge] conversion failed:', (e as Error)?.message); }
  try { await logAudit({ action: 'PAYMENT_CHARGED', actor: 'system', summary: `Charge completed (£${(amountReceivedPence / 100).toFixed(2)})`, bookingId, clientId: booking.clientId }); } catch { /* non-fatal */ }
  return true;
}

/**
 * Record an ASYNCHRONOUS charge failure (reported by Stripe via webhook), so a
 * decline/expiry that happens after the synchronous attempt is visible to staff
 * rather than silently lost. Leaves a follow-up note on the client + audit log.
 */
export async function recordChargeFailure(bookingId: string, reason: string): Promise<void> {
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return;
  const msg = `Card charge failed — follow up: ${reason}`.slice(0, 200);
  try { await db.interaction.create({ data: { clientId: booking.clientId, type: 'APPOINTMENT', summary: msg, author: 'system' } }); } catch { /* non-fatal */ }
  try { await logAudit({ action: 'PAYMENT_FAILED', actor: 'system', summary: msg, bookingId, clientId: booking.clientId }); } catch { /* non-fatal */ }
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

export const MAX_RESCHEDULES = 3;
// Clients must give at least 48 hours notice to reschedule online.
export const RESCHEDULE_WINDOW_MS = 48 * 60 * 60 * 1000;

export function canReschedule(b: Pick<import('@prisma/client').Booking, 'startAt' | 'rescheduleCount' | 'status'>): { ok: boolean; reason?: string } {
  if (['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(b.status)) return { ok: false, reason: 'This booking can no longer be changed.' };
  if (b.rescheduleCount >= MAX_RESCHEDULES) return { ok: false, reason: `Maximum of ${MAX_RESCHEDULES} reschedules reached. Please call us to make further changes.` };
  if (b.startAt.getTime() - Date.now() < RESCHEDULE_WINDOW_MS) return { ok: false, reason: 'Less than 48 hours until your appointment. Please call us to reschedule.' };
  return { ok: true };
}

export async function rescheduleBooking(
  bookingId: string,
  newStartISO: string,
  opts: { by: string },
): Promise<{ ok: boolean; error?: string }> {
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { client: true } });
  if (!booking) return { ok: false, error: 'Booking not found.' };
  const check = canReschedule(booking);
  if (!check.ok) return { ok: false, error: check.reason };

  const newStart = new Date(newStartISO);
  if (isNaN(newStart.getTime())) return { ok: false, error: 'Invalid date/time.' };
  // Validate the new slot isn't in the past.
  if (newStart.getTime() < Date.now()) return { ok: false, error: 'The requested slot is in the past.' };

  const durationMs = booking.endAt.getTime() - booking.startAt.getTime();
  const newEnd = new Date(newStart.getTime() + durationMs);

  const oldStart = booking.startAt;
  await db.booking.update({
    where: { id: bookingId },
    data: { startAt: newStart, endAt: newEnd, rescheduleCount: { increment: 1 } },
  });

  await db.interaction.create({
    data: {
      clientId: booking.clientId,
      type: 'APPOINTMENT',
      summary: `Rescheduled ${booking.treatmentTitle} from ${oldStart.toLocaleString('en-GB')} to ${newStart.toLocaleString('en-GB')}`,
      author: opts.by,
    },
  });

  await logAudit({ action: 'BOOKING_RESCHEDULED', actor: opts.by, bookingId: booking.id, clientId: booking.clientId, summary: `Rescheduled to ${newStart.toISOString()}` }).catch(() => {});

  const manageUrl = `${process.env.NEXT_PUBLIC_SITE_URL || site.url}/booking/manage?t=${booking.manageToken}`;
  await sendEmail({
    to: booking.client.email,
    subject: `Booking rescheduled — ${booking.treatmentTitle}`,
    html: tmplBookingRescheduled({ firstName: booking.client.firstName, treatment: booking.treatmentTitle, oldStart, newStart, manageUrl }),
  });

  // Re-push the booking to the clinic calendar with the new slot (PUT overwrites).
  import('@/lib/hostinger-calendar').then((m) => m.pushBooking(booking.id)).catch(() => {});

  return { ok: true };
}
