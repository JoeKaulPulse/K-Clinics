import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';
import { stripeEnabled } from '@/lib/stripe';

export const runtime = 'nodejs';

// Called by /booking/pay after the client authenticates an off-session charge.
// Verifies with Stripe that the PaymentIntent really succeeded (and that the
// caller holds its secret), then finalises the booking charge. Idempotent and
// safe to be public: it only acts on a genuinely-succeeded PaymentIntent.
export async function POST(req: Request) {
  if (!crmEnabled || !stripeEnabled) return NextResponse.json({ ok: false }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const clientSecret = typeof body.pi === 'string' ? body.pi : '';
  if (!clientSecret.startsWith('pi_') || !clientSecret.includes('_secret_')) {
    return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
  }

  const piId = clientSecret.split('_secret_')[0];
  const { stripe } = await import('@/lib/stripe');
  const pi = await stripe().paymentIntents.retrieve(piId).catch(() => null);
  if (!pi || pi.client_secret !== clientSecret) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  if (pi.status !== 'succeeded') return NextResponse.json({ ok: false, error: 'Payment not complete' }, { status: 409 });

  const bookingId = pi.metadata?.bookingId;
  if (!bookingId) return NextResponse.json({ ok: false, error: 'Not a booking payment' }, { status: 400 });

  const { finalizeBookingCharge } = await import('@/lib/booking-actions');
  await finalizeBookingCharge(bookingId, pi.id, pi.amount_received ?? pi.amount, { late: pi.metadata?.late === 'true' });
  return NextResponse.json({ ok: true });
}
