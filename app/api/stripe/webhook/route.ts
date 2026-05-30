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
          await db.booking.updateMany({
            where: { id: bookingId, chargedAt: null },
            data: { chargePaymentIntentId: pi.id, chargedPence: pi.amount_received, chargedAt: new Date() },
          });
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
