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
        if (pi.metadata?.kind === 'gift_voucher' && pi.metadata?.voucherId) {
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
