import 'server-only';
import { db } from './db';
import { stripe } from './stripe';
import { site } from './site';
import {
  sendEmail,
  tmplBookingCancelled,
  tmplChargeReceipt,
  tmplPaymentActionRequired,
  tmplBookingRescheduled,
} from './email';
import { logAudit } from './audit';
import type { Booking, Client } from '@prisma/client';

const CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000;
const RESCHEDULE_WINDOW_MS = 48 * 60 * 60 * 1000;
const MAX_FREE_RESCHEDULES = 3;

type BookingWithClient = Booking & { client: Client };

export function isWithin24h(b: Pick<Booking, 'startAt'>): boolean {
  return b.startAt.getTime() - Date.now() < CANCEL_WINDOW_MS;
}

/**
 * Gather the rich detail for a stylised, itemised receipt: line items (primary
 * treatment + any add-ons), clinician, clinic-local date, a short reference and
 * the card used. All best-effort — the receipt still sends if any part fails.
 */
async function receiptDetail(bookingId: string, paymentMethodId?: string | null): Promise<{
  items: { label: string; pricePence: number }[];
  clinician: string | null;
  dateLabel: string | null;
  reference: string;
  paymentMethod: string | null;
}> {
  const [items, bk] = await Promise.all([
    db.bookingItem.findMany({ where: { bookingId }, orderBy: { createdAt: 'asc' }, select: { label: true, pricePence: true, discountPence: true } }).catch(() => []),
    db.booking.findUnique({ where: { id: bookingId }, select: { startAt: true, practitioner: { select: { name: true } } } }).catch(() => null),
  ]);
  let paymentMethod: string | null = null;
  if (paymentMethodId) {
    try {
      const pm = await stripe().paymentMethods.retrieve(paymentMethodId);
      if (pm.card) { const b = pm.card.brand || 'card'; paymentMethod = `${b.charAt(0).toUpperCase()}${b.slice(1)} •••• ${pm.card.last4}`; }
    } catch { /* payment-method line is optional */ }
  }
  let dateLabel: string | null = null;
  if (bk) {
    try {
      const { fmtClinicDate, fmtClinicTime } = await import('./clinic-time');
      dateLabel = `${fmtClinicDate(bk.startAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${fmtClinicTime(bk.startAt)}`;
    } catch { /* date line is optional */ }
  }
  return {
    items: items.map((i) => ({ label: i.label, pricePence: i.pricePence - (i.discountPence || 0) })),
    clinician: bk?.practitioner?.name ?? null,
    dateLabel,
    reference: bookingId.slice(-6).toUpperCase(),
    paymentMethod,
  };
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
  // BLD-147/246: idempotency. Cheap early-out on caller-supplied data; then re-fetch
  // from DB so two concurrent staff actions that both read chargedAt:null don't both
  // reach Stripe and create two PaymentIntents.
  if (booking.chargedAt) return { ok: true };
  const fresh = await db.booking.findUnique({ where: { id: booking.id }, select: { chargedAt: true } });
  if (fresh?.chargedAt) return { ok: true };

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
    }, {
      // …and a stable idempotency key so concurrent creates collapse to ONE
      // PaymentIntent at Stripe (one charge per booking, treatment vs late-fee).
      idempotencyKey: `booking-charge-${booking.id}-${opts.late ? 'late' : 'treatment'}`,
    });

    if (pi.status === 'succeeded') {
      await db.booking.update({
        where: { id: booking.id },
        data: { chargePaymentIntentId: pi.id, chargedPence: amountPence, chargedAt: new Date() },
      });
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
      // Receipt email — guarded so a detail lookup or send hiccup can't 500 a
      // charge that has ALREADY gone through, and recorded with its REAL outcome
      // (this path previously logged SENT before the send was even attempted,
      // masking provider/config failures like an unverified domain).
      const detail = opts.late ? null : await receiptDetail(booking.id, booking.stripePaymentMethodId).catch(() => null);
      const receipt = await sendEmail({
        to: booking.client.email,
        subject: opts.late ? 'Late-cancellation fee — KClinics' : `Receipt — ${booking.treatmentTitle}`,
        html: tmplChargeReceipt({ firstName: booking.client.firstName, treatment: booking.treatmentTitle, pricePence: amountPence, late: opts.late, vat, ...(detail ?? {}) }),
      });
      if (!receipt.ok) console.error('[charge] receipt email failed:', receipt.error);
      await db.emailEvent.create({ data: { clientId: booking.clientId, kind: 'MANUAL', to: booking.client.email, subject: 'Payment receipt', status: receipt.ok ? 'SENT' : 'FAILED', providerId: receipt.id, error: receipt.error } }).catch(() => {});
      // Books: raise the Xero invoice (+ payment). Idempotent vs the webhook path.
      try { const { pushBookingSaleToXero } = await import('@/lib/xero'); await pushBookingSaleToXero(booking.id); } catch (e) { console.error('[charge] xero push failed:', (e as Error)?.message); }
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
    }, { idempotencyKey: `refund-${booking.id}-from-${booking.refundedPence ?? 0}-${amount}` });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Refund failed at Stripe.' };
  }

  const totalRefunded = (booking.refundedPence ?? 0) + amount;
  const fully = totalRefunded >= (booking.chargedPence ?? 0);
  // CAS: only the writer that advances refundedPence from the value we read runs
  // the side-effects. Guards the race where a concurrent webhook echo or a second
  // in-app click creates a Stripe refund with the same idempotencyKey (no-op at
  // Stripe) but both callers reach this point — the second writer's updateMany
  // returns count=0 and we return early, so loyalty and Xero fire exactly once.
  // Mirrors the same pattern in the charge.refunded webhook handler.
  const claimed = await db.booking.updateMany({
    where: { id: booking.id, refundedPence: booking.refundedPence },
    data: { refundedPence: totalRefunded, refundedAt: new Date(), refundReason: opts.reason?.slice(0, 500) || booking.refundReason || null },
  });
  if (claimed.count === 0) return { ok: true, refundedPence: totalRefunded };

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

  // Books: raise the matching Xero credit note (+ cash refund), best-effort.
  try { const { pushBookingRefundToXero } = await import('@/lib/xero'); await pushBookingRefundToXero(booking.id, amount, opts.reason); } catch { /* non-fatal */ }

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
    // VAT breakdown on the receipt once the clinic is VAT-registered (dormant otherwise).
    let vat: { netPence: number; vatPence: number; ratePct: number } | null = null;
    try {
      const { getVatConfig, effectiveVatClass, vatBreakdown } = await import('@/lib/vat');
      const cfg = await getVatConfig();
      if (cfg.registered) {
        const { getServiceByTreatment } = await import('@/lib/services');
        const svc = await getServiceByTreatment(booking.treatmentSlug);
        const b = vatBreakdown(amountReceivedPence, cfg, effectiveVatClass({ vatClass: svc?.vatClass, category: svc?.category }));
        if (b.applied) vat = { netPence: b.netPence, vatPence: b.vatPence, ratePct: b.ratePct };
      }
    } catch { /* receipt still sends without the VAT line */ }
    const detail = opts.late ? null : await receiptDetail(booking.id, booking.stripePaymentMethodId);
    await sendEmail({
      to: booking.client.email,
      subject: opts.late ? 'Late-cancellation fee — KClinics' : `Receipt — ${booking.treatmentTitle}`,
      html: tmplChargeReceipt({ firstName: booking.client.firstName, treatment: booking.treatmentTitle, pricePence: amountReceivedPence, late: opts.late, vat, ...(detail ?? {}) }),
    });
    await db.emailEvent.create({ data: { clientId: booking.clientId, kind: 'MANUAL', to: booking.client.email, subject: 'Payment receipt', status: 'SENT' } });
  } catch (e) { console.error('[charge] receipt failed:', (e as Error)?.message); }
  try { const { awardClientSpend } = await import('./client-loyalty'); await awardClientSpend(bookingId); } catch (e) { console.error('[charge] loyalty failed:', (e as Error)?.message); }
  try { const { pushBookingSaleToXero } = await import('@/lib/xero'); await pushBookingSaleToXero(bookingId); } catch (e) { console.error('[charge] xero push failed:', (e as Error)?.message); }
  try { const { sendPurchase } = await import('./conversions'); await sendPurchase({ bookingId, valuePence: amountReceivedPence, clientId: booking.clientId, email: booking.client.email, campaign: booking.attribCampaign, gclid: booking.gclid }); } catch (e) { console.error('[charge] conversion failed:', (e as Error)?.message); }
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

  // BLD-133: the slot just freed — offer it to the first matching waitlister.
  import('@/lib/waitlist').then((m) => m.notifyOnFreedSlot(booking.treatmentSlug, booking.startAt)).catch(() => {});
  if (feeFailed) {
    await logAudit({ action: 'PAYMENT_FAILED', actor: opts.by, bookingId: booking.id, clientId: booking.clientId, summary: `Late-cancellation fee (£${(booking.pricePence / 100).toFixed(2)}) failed — follow up.` }).catch(() => {});
  }

  // Remove from the shared clinic calendar (Hostinger CalDAV; no-op if unconfigured).
  import('@/lib/hostinger-calendar').then((m) => m.removeBooking(booking.id)).catch(() => {});
  // Remove from the clinician's Google Calendar too (no-op while parked).
  import('@/lib/google-calendar').then((m) => m.removeBookingFromClinician(booking.id)).catch(() => {});

  // Return any loyalty points the client had applied to this booking.
  try {
    const { refundBookingPoints } = await import('@/lib/client-loyalty');
    await refundBookingPoints(booking.id);
  } catch (e) {
    console.error('[cancelBooking] points refund failed (continuing):', (e as Error)?.message);
  }

  // Cancellation email (free vs late-fee) — best-effort, with its outcome recorded
  // so a silent provider/config failure is visible in the email log.
  const cancelEmail = await sendEmail({
    to: booking.client.email,
    subject: `Booking cancelled — ${booking.treatmentTitle}`,
    html: tmplBookingCancelled({ firstName: booking.client.firstName, treatment: booking.treatmentTitle, start: booking.startAt, feeCharged: charged || undefined }),
  });
  if (!cancelEmail.ok) console.error('[cancelBooking] email failed:', cancelEmail.error);
  await db.emailEvent.create({ data: { clientId: booking.clientId, kind: 'MANUAL', to: booking.client.email, subject: 'Booking cancelled', status: cancelEmail.ok ? 'SENT' : 'FAILED', providerId: cancelEmail.id, error: cancelEmail.error } }).catch(() => {});

  return { ok: true, charged, requiresAction, feeFailed };
}

export function isWithin48h(b: Pick<Booking, 'startAt'>): boolean {
  return b.startAt.getTime() - Date.now() < RESCHEDULE_WINDOW_MS;
}

/**
 * Reschedule a booking to a new start time.
 * Rules:
 * - Must give >=48h notice from the CURRENT appointment time
 * - First 3 reschedules are free; 4th+ charges the full booking price
 * - New startAt must be at least 48h in the future
 */
export async function rescheduleBooking(
  bookingId: string,
  newStartISO: string,
  opts: { by: string; reason?: string; admin?: boolean },
): Promise<{ ok: boolean; charged?: number; requiresAction?: boolean; error?: string; code?: 'SLOT_TAKEN' }> {
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { client: true } });
  if (!booking) return { ok: false, error: 'Booking not found.' };
  if (['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(booking.status)) {
    return { ok: false, error: 'This booking can no longer be rescheduled.' };
  }
  // Client self-service must give >=48h notice; staff (admin) can move any time.
  if (!opts.admin && isWithin48h(booking)) {
    return { ok: false, error: "Reschedules require at least 48 hours' notice. Please call us on 020 8050 0750 if you need to make a late change." };
  }

  const newStart = new Date(newStartISO);
  if (isNaN(newStart.getTime())) return { ok: false, error: 'Invalid date.' };
  if (newStart.getTime() <= Date.now()) return { ok: false, error: 'The new appointment time must be in the future.' };
  if (!opts.admin && newStart.getTime() - Date.now() < RESCHEDULE_WINDOW_MS) {
    return { ok: false, error: 'The new appointment must be at least 48 hours from now.' };
  }

  const newEnd = new Date(newStart.getTime() + booking.durationMin * 60 * 1000);

  // The chosen time must be a genuinely free, in-hours slot — the same guard every
  // booking-creation path uses. Without this a crafted POST could move a booking
  // outside opening hours or on top of another appointment (the UI only offers
  // valid slots, but the API must not trust the client).
  const { isSlotFree } = await import('@/lib/availability');
  // BLD-192: an admin reschedule may move an appointment to any free time (the
  // 48h-notice gate above already governs client self-service); a staff move must
  // not be blocked by the public 2-hour online lead window.
  // Exclude this booking from the clash check so a same-day move doesn't conflict
  // with its own current slot/clinician/room (BLD reschedule self-clash).
  if (!(await isSlotFree(newStartISO, booking.durationMin, booking.treatmentSlug, null, { excludeBookingId: bookingId, ...(opts.admin ? { leadMinutes: 0 } : {}) }))) {
    return { ok: false, code: 'SLOT_TAKEN', error: 'That time is no longer available. Please choose another slot.' };
  }

  let charged = 0;
  let requiresAction = false;

  // 4th+ reschedule incurs the full booking price — client self-service only;
  // a staff/admin reschedule never charges a fee.
  if (!opts.admin && booking.rescheduleCount >= MAX_FREE_RESCHEDULES && booking.pricePence > 0) {
    const res = await chargeBooking(booking, booking.pricePence, { late: false });
    if (!res.ok) {
      if (res.requiresAction) requiresAction = true;
      else return { ok: false, error: res.error || 'Payment required for this reschedule could not be processed.' };
    } else {
      charged = booking.pricePence;
    }
  }

  await db.booking.update({
    where: { id: booking.id },
    data: { startAt: newStart, endAt: newEnd, rescheduleCount: { increment: 1 } },
  });

  await db.interaction.create({
    data: {
      clientId: booking.clientId,
      type: 'APPOINTMENT',
      summary: `Rescheduled ${booking.treatmentTitle} from ${booking.startAt.toLocaleString('en-GB')} to ${newStart.toLocaleString('en-GB')}${charged ? ` — charged £${(charged / 100).toFixed(2)} (reschedule ${booking.rescheduleCount + 1})` : ''}`,
      author: opts.by,
    },
  });

  await logAudit({
    action: 'BOOKING_RESCHEDULED',
    actor: opts.by,
    bookingId: booking.id,
    clientId: booking.clientId,
    summary: `Rescheduled to ${newStart.toISOString()}`,
    meta: { from: booking.startAt.toISOString(), to: newStart.toISOString(), rescheduleCount: booking.rescheduleCount + 1 },
  }).catch(() => {});

  // Update the shared clinic calendar entry to the new time (best-effort). The
  // CalDAV event is keyed by booking id, so re-pushing PUTs the moved times over
  // the existing entry — we must NOT remove it (that would drop the appointment
  // from the clinic calendar entirely).
  import('@/lib/hostinger-calendar').then((m) => m.pushBooking(booking.id)).catch(() => {});
  // Move the clinician's Google Calendar event to the new time (no-op while parked).
  import('@/lib/google-calendar').then((m) => m.pushBookingToClinician(booking.id)).catch(() => {});

  // Confirmation email (best-effort).
  await sendEmail({
    to: booking.client.email,
    subject: `Appointment rescheduled — ${booking.treatmentTitle}`,
    html: tmplBookingRescheduled({
      firstName: booking.client.firstName,
      treatment: booking.treatmentTitle,
      oldStart: booking.startAt,
      newStart,
      feeCharged: charged || undefined,
      reschedulesLeft: Math.max(0, MAX_FREE_RESCHEDULES - (booking.rescheduleCount + 1)),
    }),
  }).catch(() => {});

  return { ok: true, charged, requiresAction };
}
