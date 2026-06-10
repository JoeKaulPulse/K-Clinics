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
          // Idempotent: records the charge, emails the receipt and credits loyalty
          // if it hasn't already been finalised synchronously. This is the backstop
          // that completes an SCA charge once the client authenticates via /booking/pay.
          const { finalizeBookingCharge } = await import('@/lib/booking-actions');
          await finalizeBookingCharge(bookingId, pi.id, pi.amount_received ?? pi.amount, { late: pi.metadata?.late === 'true' });
        }
        // Finalise retail orders + gift vouchers server-side, so they complete
        // even if the customer closes the tab before the confirm call.
        if (pi.metadata?.kind === 'shop_order' && pi.metadata?.orderId) {
          try { const { finalizeOrder } = await import('@/lib/shop'); await finalizeOrder(pi.metadata.orderId); } catch (e) { console.error('[webhook] order finalize failed:', (e as Error)?.message); }
        }
        if ((pi.metadata?.kind === 'gift_voucher' || pi.metadata?.kind === 'gift_package') && pi.metadata?.voucherId) {
          try { const { confirmVoucher } = await import('@/lib/gift-vouchers'); await confirmVoucher(pi.metadata.voucherId); } catch (e) { console.error('[webhook] voucher confirm failed:', (e as Error)?.message); }
        }
        break;
      }
      case 'charge.refunded': {
        // A refund issued directly in the Stripe dashboard: sync the booking's
        // refunded amount and run the same side-effects as refundBooking so
        // loyalty, Xero and GA4 all stay in sync.
        //
        // Idempotency / no double-counting: refunds raised in-app via
        // refundBooking() carry metadata.bookingId and already run every
        // side-effect themselves. Such refunds still fire this webhook (and may
        // race ahead of refundBooking's own DB write), so we skip the whole
        // handler when any refund on the charge originated in-app — otherwise
        // we'd raise a SECOND Xero credit note and a SECOND GA4 refund event.
        // For genuine dashboard refunds we advance refundedPence with a
        // compare-and-swap; if it's already at the target (webhook retry or a
        // concurrent writer) the update no-ops and we skip the side-effects.
        const charge = event.data.object;
        const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : null;
        const originatedInApp = (charge.refunds?.data ?? []).some((r) => Boolean(r.metadata?.bookingId));
        if (piId && !originatedInApp) {
          try {
            const booking = await db.booking.findFirst({ where: { chargePaymentIntentId: piId }, include: { client: true } });
            if (booking) {
              const totalRefundedPence = charge.amount_refunded ?? 0;
              const alreadyRecorded = booking.refundedPence ?? 0;
              const delta = totalRefundedPence - alreadyRecorded;
              if (delta > 0) {
                const fully = totalRefundedPence >= (booking.chargedPence ?? 0);
                // CAS: only the writer that advances refundedPence past the value
                // it observed runs the side-effects. Guards webhook redeliveries.
                const claimed = await db.booking.updateMany({
                  where: { id: booking.id, refundedPence: booking.refundedPence },
                  data: { refundedPence: totalRefundedPence, refundedAt: new Date() },
                });
                if (claimed.count > 0) {
                  if (fully) { try { const { refundBookingPoints } = await import('@/lib/client-loyalty'); await refundBookingPoints(booking.id); } catch { /* non-fatal */ } }
                  try { const { sendRefund } = await import('@/lib/conversions'); await sendRefund({ bookingId: booking.id, valuePence: delta, clientId: booking.clientId }); } catch { /* non-fatal */ }
                  try { const { pushBookingRefundToXero } = await import('@/lib/xero'); await pushBookingRefundToXero(booking.id, delta, 'Stripe dashboard refund'); } catch { /* non-fatal */ }
                  await db.interaction.create({ data: { clientId: booking.clientId, type: 'APPOINTMENT', summary: `Stripe-dashboard refund synced: £${(delta / 100).toFixed(2)} for ${booking.treatmentTitle}`, author: 'stripe-webhook' } }).catch(() => {});
                }
              }
            }
          } catch (e) { console.error('[webhook] charge.refunded sync failed:', (e as Error)?.message); }
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
          await recordChargeFailure(bookingId, pi.last_payment_error?.message || 'The card was declined.');
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
      default:
        break;
    }
  } catch (e) {
    console.error('webhook handler error', e);
  }

  return NextResponse.json({ received: true });
}
