import { NextResponse } from 'next/server';
import { stripeEnabled, stripe } from '@/lib/stripe';

export const runtime = 'nodejs';

// Keeps booking/payment state in sync with Stripe. Verifies the signature with
// STRIPE_WEBHOOK_SECRET. Configure this endpoint in the Stripe dashboard.
export async function POST(req: Request) {
  if (!stripeEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get('stripe-signature');
  if (!secret || !sig) return NextResponse.json({ ok: false }, { status: 400 });

  const body = await req.text();
  let event;
  try {
    event = stripe().webhooks.constructEvent(body, sig, secret);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 400 });
  }

  const { db } = await import('@/lib/db');

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        const bookingId = pi.metadata?.bookingId;
        if (bookingId) {
          // BLD-396: guard against underpayment on full-balance booking charges.
          if (pi.metadata?.kind === 'booking_balance') {
            const bk = await db.booking.findUnique({ where: { id: bookingId }, select: { pricePence: true } });
            if (bk && (pi.amount_received ?? 0) < bk.pricePence) {
              console.error('[webhook] booking balance underpayment — not finalising:', { received: pi.amount_received, expected: bk.pricePence, bookingId });
              break;
            }
          }
          // Idempotent: records the charge, emails the receipt and credits loyalty
          // if it hasn't already been finalised synchronously. This is the backstop
          // that completes an SCA charge once the client authenticates via /booking/pay.
          const { finalizeBookingCharge } = await import('@/lib/booking-actions');
          await finalizeBookingCharge(bookingId, pi.id, pi.amount_received ?? pi.amount, { late: pi.metadata?.late === 'true' });
        }
        // Finalise retail orders server-side so they complete even if the customer
        // closes the tab. Assert amount_received matches the stored order total to
        // guard against discount/currency manipulation.
        if (pi.metadata?.kind === 'shop_order' && pi.metadata?.orderId) {
          try {
            const order = await db.order.findUnique({ where: { id: pi.metadata.orderId }, select: { totalPence: true } });
            if (order && pi.currency === 'gbp' && pi.amount_received >= order.totalPence) {
              const { finalizeOrder } = await import('@/lib/shop');
              await finalizeOrder(pi.metadata.orderId);
            } else {
              console.error('[webhook] shop order skipped — amount mismatch or currency:', { received: pi.amount_received, expected: order?.totalPence, currency: pi.currency });
            }
          } catch (e) { console.error('[webhook] order finalize failed:', (e as Error)?.message); }
        }
        // BLD-119: handle both gift_voucher and gift_package — gift_package used the
        // wrong kind constant so the webhook backstop never confirmed it, leaving
        // paid-but-tab-closed purchases stuck in PENDING.
        if ((pi.metadata?.kind === 'gift_voucher' || pi.metadata?.kind === 'gift_package') && pi.metadata?.voucherId) {
          try { const { confirmVoucher } = await import('@/lib/gift-vouchers'); await confirmVoucher(pi.metadata.voucherId); } catch (e) { console.error('[webhook] voucher confirm failed:', (e as Error)?.message); }
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        // An off-session charge that failed asynchronously (decline/expiry).
        // Make it visible to staff instead of letting it vanish.
        const pi = event.data.object;
        const bookingId = pi.metadata?.bookingId;
        if (bookingId) {
          const { recordChargeFailure } = await import('@/lib/booking-actions');
          const reason = pi.last_payment_error?.message || 'The card was declined.';
          await recordChargeFailure(bookingId, reason);
          try {
            const { notifyStaffByPermission } = await import('@/lib/notifications');
            await notifyStaffByPermission('finance.view', { kind: 'status', category: 'finance', priority: 'urgent', title: 'Payment failed', body: reason.slice(0, 140), href: `/admin/bookings/${bookingId}` });
          } catch { /* non-fatal */ }
        }
        break;
      }
      case 'setup_intent.succeeded': {
        const si = event.data.object;
        const bookingId = si.metadata?.bookingId;
        const pm = typeof si.payment_method === 'string' ? si.payment_method : si.payment_method?.id;
        if (bookingId && pm) {
          await db.booking.updateMany({
            where: { id: bookingId, stripePaymentMethodId: null },
            data: { stripePaymentMethodId: pm },
          });
        }
        break;
      }
      // BLD-123: refunds issued directly in the Stripe dashboard bypass the app.
      // Reconcile: compute the delta vs what's already recorded and run the same
      // post-refund side-effects (loyalty reversal, Xero credit note, audit log).
      case 'charge.refunded': {
        const charge = event.data.object;
        const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : null;
        if (!piId) break;
        // Refunds raised in-app via refundBooking() carry metadata.bookingId and
        // already run every side-effect themselves. Their webhook echo can race
        // ahead of refundBooking's own DB write — without this skip we'd raise a
        // SECOND Xero credit note and double-log the refund.
        const originatedInApp = (charge.refunds?.data ?? []).some((r) => Boolean(r.metadata?.bookingId));
        if (originatedInApp) break;
        const booking = await db.booking.findFirst({
          where: { chargePaymentIntentId: piId },
          include: { client: true },
        });
        if (!booking) break;
        const totalRefundedByStripe = charge.amount_refunded ?? 0;
        const alreadyRecorded = booking.refundedPence ?? 0;
        const delta = totalRefundedByStripe - alreadyRecorded;
        if (delta <= 0) break; // already fully reconciled
        const newTotal = alreadyRecorded + delta;
        const fully = newTotal >= (booking.chargedPence ?? 0);
        // Compare-and-swap: only the writer that advances refundedPence past the
        // value it observed runs the side-effects. Guards webhook redeliveries.
        const claimed = await db.booking.updateMany({
          where: { id: booking.id, refundedPence: booking.refundedPence },
          data: { refundedPence: newTotal, refundedAt: new Date() },
        });
        if (claimed.count === 0) break; // a concurrent writer got there first
        if (fully) {
          try { const { refundBookingPoints } = await import('@/lib/client-loyalty'); await refundBookingPoints(booking.id); } catch { /* non-fatal */ }
        }
        try { const { pushBookingRefundToXero } = await import('@/lib/xero'); await pushBookingRefundToXero(booking.id, delta, 'Stripe refund'); } catch { /* non-fatal */ }
        try { const { logAudit } = await import('@/lib/audit'); await logAudit({ action: 'PAYMENT_REFUNDED', actor: 'stripe-webhook', bookingId: booking.id, clientId: booking.clientId, summary: `Webhook refund £${(delta / 100).toFixed(2)}${fully ? ' (full)' : ' (partial)'}`, meta: { delta, fully } }); } catch { /* non-fatal */ }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error('webhook handler error', e);
    // Return 500 for revenue-critical events so Stripe retries rather than
    // silently dropping the event on a transient DB failure.
    // BLD-412: setup_intent.succeeded must also retry — a 200 on DB failure
    // tells Stripe "delivered", losing the saved card permanently.
    const critical = event.type === 'payment_intent.succeeded' || event.type === 'charge.refunded' || event.type === 'setup_intent.succeeded';
    if (critical) return NextResponse.json({ received: false, error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
