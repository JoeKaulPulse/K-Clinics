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
import { CLINIC_TZ } from './clinic-time';
import type { Booking, Client } from '@prisma/client';

const CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000;
const RESCHEDULE_WINDOW_MS = 48 * 60 * 60 * 1000;
const MAX_FREE_RESCHEDULES = 3;

type BookingWithClient = Booking & { client: Client };

export function isWithin24h(b: Pick<Booking, 'startAt'>): boolean {
  return b.startAt.getTime() - Date.now() < CANCEL_WINDOW_MS;
}

/**
 * Full price of a course booking, in pence — the single source of truth for the
 * BNPL pre-payment amount (BLD-399) and its webhook validation. The primary
 * (non-add-on) line item holds the course total: create-action.ts sets its
 * pricePence to (price-per-session × sessions), and the booking detail derives
 * `basePence` the same way (booking.pricePence minus add-ons). We read the
 * primary item directly so the link, the validation and the badge all agree.
 * Returns { pence, sessions, label }; pence is 0 for an on-consultation (£0)
 * booking, which callers must reject (nothing to pre-pay).
 */
export async function courseTotalPence(bookingId: string): Promise<{ pence: number; sessions: number; label: string } | null> {
  const booking = await db.booking.findUnique({ where: { id: bookingId }, select: { pricePence: true, treatmentTitle: true } });
  if (!booking) return null;
  const primary = await db.bookingItem.findFirst({
    where: { bookingId, isAddon: false },
    orderBy: { createdAt: 'asc' },
    select: { pricePence: true, sessions: true, label: true },
  });
  // Prefer the primary line item (course total + session count). Fall back to
  // the booking price for legacy bookings created without line items.
  const sessions = Math.max(1, primary?.sessions ?? 1);
  const pence = primary?.pricePence ?? booking.pricePence ?? 0;
  return { pence, sessions, label: primary?.label || booking.treatmentTitle };
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
        data: { chargePaymentIntentId: pi.id, chargedPence: pi.amount_received ?? amountPence, chargedAt: new Date() },
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
      // BLD-716: link with the PaymentIntent ID only — never the client_secret.
      // The secret authorises card confirmation and would otherwise be logged in
      // Vercel access logs, the browser history and the email itself. The pay
      // page fetches the secret server-side from this ID.
      const payUrl = `${process.env.NEXT_PUBLIC_SITE_URL || site.url}/booking/pay?pi=${err.raw.payment_intent.id}`;
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

  // External/cash payments are recorded with chargePaymentIntentId = "ext_cash" /
  // "ext_card" — there's no Stripe charge to reverse (the money was taken at the till),
  // so skip Stripe and just record the refund below; staff hand the cash back. Calling
  // Stripe here failed with "No such payment_intent: 'ext_cash'".
  const isExternalPayment = (booking.chargePaymentIntentId || '').startsWith('ext_');
  // BLD-882: a voucher-settled booking DOES have a reversal rail, unlike cash —
  // the refund goes back onto the voucher (capped at face value by
  // creditVoucher). Without this, "refunded" would be recorded while the
  // client's card value stayed silently spent.
  if (booking.chargePaymentIntentId === 'ext_gift-voucher') {
    if (!booking.giftVoucherCode) return { ok: false, error: 'This booking was paid by gift voucher but the voucher code is missing — refund it manually from the voucher manager.' };
    try {
      const { creditVoucher } = await import('@/lib/gift-vouchers');
      await creditVoucher(booking.giftVoucherCode, amount);
    } catch (e) {
      return { ok: false, error: `Couldn’t return the balance to voucher ${booking.giftVoucherCode} — try again. (${(e as Error)?.message || 'unknown error'})` };
    }
  }
  if (!isExternalPayment) {
    try {
      await stripe().refunds.create({
        payment_intent: booking.chargePaymentIntentId,
        amount,
        metadata: { bookingId: booking.id, reason: (opts.reason || '').slice(0, 200) },
      }, { idempotencyKey: `refund-${booking.id}-from-${booking.refundedPence ?? 0}-${amount}` });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Refund failed at Stripe.' };
    }
  }

  // CAS: only the writer that advances refundedPence from the value we read runs
  // the side-effects below. Guards the race where a concurrent webhook echo or a
  // second in-app click creates a Stripe refund with the same idempotencyKey
  // (no-op at Stripe) but both callers reach this point. Unlike a lost-race
  // no-op, though, the Stripe refund above HAS already happened — so on a lost
  // CAS we re-read the booking and retry (up to 2 times), mirroring the
  // charge.refunded webhook handler's pattern, rather than silently dropping
  // the loyalty/Xero/email side-effects for this refund.
  let current = booking;
  let totalRefunded = (current.refundedPence ?? 0) + amount;
  let fully = totalRefunded >= (current.chargedPence ?? 0);
  let claimed = { count: 0 };
  for (let attempt = 0; ; attempt++) {
    totalRefunded = (current.refundedPence ?? 0) + amount;
    fully = totalRefunded >= (current.chargedPence ?? 0);
    claimed = await db.booking.updateMany({
      where: { id: current.id, refundedPence: current.refundedPence },
      data: { refundedPence: totalRefunded, refundedAt: new Date(), refundReason: opts.reason?.slice(0, 500) || current.refundReason || null },
    });
    if (claimed.count > 0) break;
    if (attempt >= 2) {
      // The Stripe refund already succeeded — this is a reconciliation failure
      // (we could not record it / run its side-effects), not a payment failure.
      // Surface it to staff rather than a false ok:true that drops the accounting.
      return { ok: false, error: `The £${(amount / 100).toFixed(2)} refund was processed at Stripe, but we could not record it here after retrying (another update kept winning the race) — check this booking's refund total and fix it manually.` };
    }
    const fresh = await db.booking.findUnique({ where: { id: current.id }, include: { client: true } });
    if (!fresh) {
      return { ok: false, error: `The £${(amount / 100).toFixed(2)} refund was processed at Stripe, but the booking could not be re-read to record it — check this booking's refund total and fix it manually.` };
    }
    current = fresh;
  }
  booking = current;

  // Reverse loyalty points once the booking is fully refunded (best-effort).
  if (fully) {
    try { const { refundBookingPoints } = await import('@/lib/client-loyalty'); await refundBookingPoints(booking.id); } catch { /* non-fatal */ }
  }
  // BLD-836: also claw back the SPEND points EARNED on the refunded money —
  // refundBookingPoints only returns redeemed points. Pro-rata on partials,
  // idempotent by ledger arithmetic inside the helper.
  try { const { reverseSpendPoints } = await import('@/lib/client-loyalty'); await reverseSpendPoints(booking.id, totalRefunded, booking.chargedPence ?? 0); } catch { /* non-fatal */ }

  // BLD-882: a partial-voucher booking's chargedPence is the card remainder
  // only — when THAT is fully refunded, the voucher-covered portion goes back
  // on the voucher too, mirroring the orders route's restore-on-money-reversal
  // (BLD-393). Best-effort with a loud trail: the card refund above has already
  // happened, so a credit failure must not unwind the whole refund.
  if (fully && booking.chargePaymentIntentId !== 'ext_gift-voucher' && (booking.giftVoucherPence ?? 0) > 0 && booking.giftVoucherCode) {
    try {
      const { creditVoucher } = await import('@/lib/gift-vouchers');
      await creditVoucher(booking.giftVoucherCode, booking.giftVoucherPence);
      await logAudit({ action: 'REWARD_REDEEMED', actor: opts.actor || 'system', bookingId: booking.id, clientId: booking.clientId, summary: `Gift voucher ${booking.giftVoucherCode} restored on full refund — £${(booking.giftVoucherPence / 100).toFixed(2)} back on the voucher` }).catch(() => {});
    } catch (e) {
      console.error('[refund] voucher restore failed:', (e as Error)?.message);
      const Sentry = await import('@sentry/nextjs');
      Sentry.captureException(e, { tags: { area: 'gift-vouchers', stage: 'refund-restore' } });
    }
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

  try {
    const { notifyStaffByPermission } = await import('@/lib/notifications');
    await notifyStaffByPermission('finance.view', { kind: 'status', category: 'finance', priority: 'normal', title: `Refund processed: ${booking.treatmentTitle}`, body: `£${(amount / 100).toFixed(2)} refunded`, href: `/admin/bookings/${booking.id}` });
  } catch { /* non-fatal */ }
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
    const receipt = await sendEmail({
      to: booking.client.email,
      subject: opts.late ? 'Late-cancellation fee — KClinics' : `Receipt — ${booking.treatmentTitle}`,
      html: tmplChargeReceipt({ firstName: booking.client.firstName, treatment: booking.treatmentTitle, pricePence: amountReceivedPence, late: opts.late, vat, ...(detail ?? {}) }),
    });
    if (!receipt.ok) console.error('[charge] receipt email failed:', receipt.error);
    await db.emailEvent.create({ data: { clientId: booking.clientId, kind: 'MANUAL', to: booking.client.email, subject: 'Payment receipt', status: receipt.ok ? 'SENT' : 'FAILED', providerId: receipt.id, error: receipt.error } }).catch(() => {});
  } catch (e) { console.error('[charge] receipt failed:', (e as Error)?.message); }
  // BLD-994: a late-cancellation fee is not client spend — chargeBooking()
  // (the synchronous path) never awards loyalty for it, so this async path
  // (SCA confirm / webhook) must not either.
  if (!opts.late) {
    try { const { awardClientSpend } = await import('./client-loyalty'); await awardClientSpend(bookingId); } catch (e) { console.error('[charge] loyalty failed:', (e as Error)?.message); }
  }
  try { const { pushBookingSaleToXero } = await import('@/lib/xero'); await pushBookingSaleToXero(bookingId); } catch (e) { console.error('[charge] xero push failed:', (e as Error)?.message); }
  // BLD-455: only send hashed email to Meta CAPI if the client has opted in to marketing.
  try { const { sendPurchase } = await import('./conversions'); await sendPurchase({ bookingId, valuePence: amountReceivedPence, clientId: booking.clientId, email: booking.client?.marketingOptIn ? booking.client.email : null, campaign: booking.attribCampaign, gclid: booking.gclid }); } catch (e) { console.error('[charge] conversion failed:', (e as Error)?.message); }
  try { await logAudit({ action: 'PAYMENT_CHARGED', actor: 'system', summary: `Charge completed (£${(amountReceivedPence / 100).toFixed(2)})`, bookingId, clientId: booking.clientId }); } catch { /* non-fatal */ }
  return true;
}

/**
 * Record an ASYNCHRONOUS charge failure (reported by Stripe via webhook), so a
 * decline/expiry that happens after the synchronous attempt is visible to staff
 * rather than silently lost. Leaves a follow-up note on the client + audit log.
 */
export async function recordChargeFailure(bookingId: string, reason: string): Promise<void> {
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { client: true } });
  if (!booking) return;
  const msg = `Card charge failed — follow up: ${reason}`.slice(0, 200);
  try { await db.interaction.create({ data: { clientId: booking.clientId, type: 'APPOINTMENT', summary: msg, author: 'system' } }); } catch { /* non-fatal */ }
  try { await logAudit({ action: 'PAYMENT_FAILED', actor: 'system', summary: msg, bookingId, clientId: booking.clientId }); } catch { /* non-fatal */ }
  // BLD-757: also tell the CLIENT their off-session payment did not go through, so
  // an async decline (a post-treatment or balance charge Stripe reports via the
  // webhook) is not silent to them — previously only staff were notified. The
  // late-cancellation-fee decline already emails the client separately; this
  // covers the general off-session path. Best-effort; never throws.
  try {
    if (booking.client?.email) {
      const { sendEmail, tmplManual } = await import('@/lib/email');
      const { escapeHtml } = await import('@/lib/sanitize');
      const name = escapeHtml(booking.client.firstName || 'there');
      const treatment = escapeHtml(booking.treatmentTitle);
      const body = `<p>Hi ${name},</p><p>We tried to take payment for your <strong>${treatment}</strong>, but the card on file was declined — so nothing has been charged.</p><p>Please reply to this email or give us a call and we will sort it out; it only takes a moment to settle or update your card.</p>`;
      await sendEmail({ to: booking.client.email, subject: 'We couldn’t take your payment — KClinics', html: tmplManual(body) });
    }
  } catch (e) { console.error('[charge] client decline email failed (continuing):', (e as Error)?.message); }
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
  // BLD-733: net off any loyalty points the client already redeemed as money off
  // this booking — otherwise the late fee bills the pre-discount price on top of
  // a discount the client already paid for with points.
  const chargeablePence = Math.max(0, booking.pricePence - (booking.pointsRedeemedPence ?? 0));
  let charged = 0;
  let requiresAction = false;
  let feeFailed = false;

  if (shouldCharge) {
    const res = await chargeBooking(booking, chargeablePence, { late: true });
    if (res.ok) charged = chargeablePence;
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
  // BLD-336: reconcile any open in-treatment session so a cancelled booking
  // doesn't leave a dangling ACTIVE appointmentSession. The session route already
  // refuses new actions on a cancelled booking; this closes the existing row so
  // it can't show as live in the diary. No-op when there's no open session.
  await db.appointmentSession.updateMany({
    where: { bookingId: booking.id, status: { not: 'COMPLETED' } },
    data: { status: 'CANCELLED', completedAt: new Date() },
  }).catch(() => {});
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

  // Return any loyalty points the client had applied to this booking -- but
  // only when they weren't already consumed as a discount on a late-cancellation
  // fee that actually got charged (BLD-915: chargeablePence above already nets
  // the fee by pointsRedeemedPence, so refunding here too let a client redeem
  // points for a discount, late-cancel to pay the reduced fee, and get the
  // points back as well, repeatably). charged === 0 covers every case where the
  // points weren't consumed: no fee due, the charge failed, or it needs further
  // action from the client.
  if (charged === 0) {
    try {
      const { refundBookingPoints } = await import('@/lib/client-loyalty');
      await refundBookingPoints(booking.id);
    } catch (e) {
      console.error('[cancelBooking] points refund failed (continuing):', (e as Error)?.message);
    }
  }

  // BLD-882: return a reserved-but-unconsumed gift-voucher application. The
  // discriminator is the PRE-CANCEL chargedAt (read at the top, before any late
  // fee lands): a booking already charged before cancellation consumed its
  // voucher as part of that settled sale (fully by voucher, or netted off a
  // card/cash remainder) — returning consumed value is a refund decision, made
  // deliberately via refundBooking, never automatic. A late fee charged DURING
  // this cancellation is computed from pricePence and never spends the voucher,
  // so the reservation still returns. Guarded clear so a concurrent removal
  // can't double-credit.
  if ((booking.giftVoucherPence ?? 0) > 0 && booking.giftVoucherCode && !booking.chargedAt) {
    try {
      const cleared = await db.booking.updateMany({
        where: { id: booking.id, giftVoucherCode: booking.giftVoucherCode, giftVoucherPence: booking.giftVoucherPence },
        data: { giftVoucherCode: null, giftVoucherPence: 0 },
      });
      if (cleared.count > 0) {
        const { creditVoucher } = await import('@/lib/gift-vouchers');
        await creditVoucher(booking.giftVoucherCode, booking.giftVoucherPence);
        await logAudit({ action: 'REWARD_REDEEMED', actor: opts.by, bookingId: booking.id, clientId: booking.clientId, summary: `Gift voucher ${booking.giftVoucherCode} returned on cancellation — £${(booking.giftVoucherPence / 100).toFixed(2)} back on the voucher` }).catch(() => {});
      }
    } catch (e) {
      console.error('[cancelBooking] voucher re-credit failed (continuing):', (e as Error)?.message);
    }
  }

  // Cancellation email (free vs late-fee) — best-effort, with its outcome recorded
  // so a silent provider/config failure is visible in the email log.
  const cancelEmail = await sendEmail({
    to: booking.client.email,
    subject: `Booking cancelled — ${booking.treatmentTitle}`,
    html: tmplBookingCancelled({ firstName: booking.client.firstName, treatment: booking.treatmentTitle, start: booking.startAt, feeCharged: charged || undefined, feeDeclined: feeFailed ? chargeablePence : undefined }),
  });
  if (!cancelEmail.ok) console.error('[cancelBooking] email failed:', cancelEmail.error);
  await db.emailEvent.create({ data: { clientId: booking.clientId, kind: 'MANUAL', to: booking.client.email, subject: 'Booking cancelled', status: cancelEmail.ok ? 'SENT' : 'FAILED', providerId: cancelEmail.id, error: cancelEmail.error } }).catch(() => {});

  try {
    const { notifyStaffByPermission } = await import('@/lib/notifications');
    const when = booking.startAt.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: CLINIC_TZ });
    await notifyStaffByPermission('bookings.view', { kind: 'status', category: 'bookings', priority: 'high', title: `Booking cancelled: ${booking.treatmentTitle}`, body: `${booking.client.firstName || 'A client'} · ${when}`, href: `/admin/bookings/${booking.id}` });
  } catch { /* non-fatal */ }
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
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { client: true, resources: { select: { id: true } } } });
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

  // BLD-502: validate the new time without false-rejecting genuinely free slots.
  //
  // A STAFF/admin reschedule may move an appointment to any time (BLD-105 intent:
  // "staff can move any time"). The only hard rule is not creating a real
  // double-booking. The full public availability gate (isSlotFree) over-rejects
  // here: with staff-availability enforcement on, a treatment with no matching
  // clinician competency (e.g. a consultation) falls through to a clinic-wide
  // "one appointment at a time" check, so a slot that is clearly free on the
  // calendar is refused. So for staff we check only a true clash on THIS booking's
  // own clinician or room(s); for client self-service we keep the strict gate.
  if (opts.admin) {
    const resourceIds = booking.resources.map((r) => r.id);
    const newBusyEndMs = newEnd.getTime() + booking.bufferMin * 60_000;
    // Nothing exclusive to clash on (no clinician, no room/equipment) → any future
    // time is fine (this is the consultation case BLD-502 was about).
    if (booking.practitionerId || resourceIds.length) {
      const windowStart = new Date(newStart.getTime() - 24 * 60 * 60 * 1000);
      const candidates = await db.booking.findMany({
        where: {
          id: { not: bookingId },
          status: { in: ['PENDING', 'CONFIRMED'] },
          startAt: { gte: windowStart, lte: new Date(newBusyEndMs) },
          OR: [
            ...(booking.practitionerId ? [{ practitionerId: booking.practitionerId }] : []),
            ...(resourceIds.length ? [{ resources: { some: { id: { in: resourceIds } } } }] : []),
          ],
        },
        select: { startAt: true, endAt: true, bufferMin: true },
      });
      const clash = candidates.some((b) => newStart.getTime() < b.endAt.getTime() + b.bufferMin * 60_000 && newBusyEndMs > b.startAt.getTime());
      if (clash) return { ok: false, code: 'SLOT_TAKEN', error: 'That time clashes with another appointment for the same clinician, room or equipment. Please choose another slot.' };
    }
  } else {
    // Client self-service: the chosen time must be a genuinely free, in-hours slot
    // — the same guard every public booking path uses (the API must not trust the
    // client). Exclude this booking so a same-day move doesn't clash with itself.
    const { isSlotFree } = await import('@/lib/availability');
    if (!(await isSlotFree(newStartISO, booking.durationMin, booking.treatmentSlug, null, { excludeBookingId: bookingId }))) {
      return { ok: false, code: 'SLOT_TAKEN', error: 'That time is no longer available. Please choose another slot.' };
    }
  }

  let charged = 0;
  let requiresAction = false;

  // 4th+ reschedule incurs the full booking price — client self-service only;
  // a staff/admin reschedule never charges a fee. BLD-733: net off any loyalty
  // points already redeemed as money off, so a client who redeemed points isn't
  // billed the pre-discount price.
  if (!opts.admin && booking.rescheduleCount >= MAX_FREE_RESCHEDULES && booking.pricePence > 0) {
    const rescheduleFeePence = Math.max(0, booking.pricePence - (booking.pointsRedeemedPence ?? 0));
    const res = await chargeBooking(booking, rescheduleFeePence, { late: false });
    if (!res.ok) {
      if (res.requiresAction) requiresAction = true;
      else return { ok: false, error: res.error || 'Payment required for this reschedule could not be processed.' };
    } else {
      charged = rescheduleFeePence;
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
      summary: `Rescheduled ${booking.treatmentTitle} from ${booking.startAt.toLocaleString('en-GB', { timeZone: CLINIC_TZ })} to ${newStart.toLocaleString('en-GB', { timeZone: CLINIC_TZ })}${charged ? ` — charged £${(charged / 100).toFixed(2)} (reschedule ${booking.rescheduleCount + 1})` : ''}`,
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

  try {
    const { notifyStaffByPermission } = await import('@/lib/notifications');
    const when = newStart.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: CLINIC_TZ });
    await notifyStaffByPermission('bookings.view', { kind: 'status', category: 'bookings', priority: 'high', title: `Booking rescheduled: ${booking.treatmentTitle}`, body: `${booking.client.firstName || 'A client'} · now ${when}`, href: `/admin/bookings/${booking.id}` });
  } catch { /* non-fatal */ }
  return { ok: true, charged, requiresAction };
}
