import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Finalise an order after payment succeeds (verified against Stripe).
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  if (!body.orderId) return NextResponse.json({ ok: false }, { status: 400 });

  const { db } = await import('@/lib/db');
  const order = await db.order.findUnique({ where: { id: body.orderId } });
  if (!order) return NextResponse.json({ ok: false, error: 'Order not found.' }, { status: 404 });
  if (order.status === 'PAID' || order.status === 'FULFILLED') return NextResponse.json({ ok: true, number: order.number });

  // BLD-411: an order without a stripePaymentIntentId means the DB write after
  // Stripe returned failed — there is no payment evidence, so reject immediately.
  if (!order.stripePaymentIntentId) {
    return NextResponse.json({ ok: false, error: 'Payment not found.' }, { status: 402 });
  }

  // Verify the payment actually succeeded.
  try {
    const { stripe } = await import('@/lib/stripe');
    const pi = await stripe().paymentIntents.retrieve(order.stripePaymentIntentId);
    if (pi.status !== 'succeeded') return NextResponse.json({ ok: false, error: 'Payment not completed.' }, { status: 402 });
    if (pi.amount_received < order.totalPence || pi.currency !== 'gbp') return NextResponse.json({ ok: false, error: 'Payment amount mismatch.' }, { status: 402 });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not verify payment.' }, { status: 502 });
  }

  const { finalizeOrder } = await import('@/lib/shop');
  const r = await finalizeOrder(order.id);
  return r.ok ? NextResponse.json({ ok: true, number: r.number }) : NextResponse.json({ ok: false }, { status: 500 });
}
