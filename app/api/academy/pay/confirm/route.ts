import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// BLD-528: finalise an enrolment payment synchronously after the client confirms
// on the Payment Element, so the portal updates immediately even before the
// webhook fires. Idempotent and shares finalizeEnrolmentPayment with the webhook;
// the amount is taken from Stripe (authoritative), never the client.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });

  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const paymentId = String(body.paymentId || '');
  if (!paymentId) return NextResponse.json({ ok: false, error: 'Missing payment.' }, { status: 400 });

  const { db } = await import('@/lib/db');
  // Scope to a payment that belongs to THIS student's enrolment.
  const payment = await db.enrolmentPayment.findFirst({
    where: { id: paymentId, enrolment: { studentId: student.id } },
    select: { stripePaymentIntentId: true },
  });
  if (!payment?.stripePaymentIntentId) return NextResponse.json({ ok: false, error: 'Payment not found.' }, { status: 404 });

  const { stripe, stripeEnabled } = await import('@/lib/stripe');
  if (!stripeEnabled) return NextResponse.json({ ok: false, error: 'Payments aren’t available right now.' }, { status: 503 });

  const pi = await stripe().paymentIntents.retrieve(payment.stripePaymentIntentId).catch(() => null);
  if (!pi) return NextResponse.json({ ok: false, error: 'Could not verify the payment.' }, { status: 502 });
  if (pi.status !== 'succeeded') {
    // Klarna/Clearpay can settle asynchronously; the webhook will finalise it.
    return NextResponse.json({ ok: true, pending: true });
  }

  let methodType: string | undefined;
  try {
    const chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id;
    if (chargeId) methodType = (await stripe().charges.retrieve(chargeId)).payment_method_details?.type;
  } catch { /* method is best-effort */ }

  const { finalizeEnrolmentPayment } = await import('@/lib/academy-payments');
  const r = await finalizeEnrolmentPayment(pi.id, pi.amount_received ?? 0, pi.currency, methodType);
  if (!r.ok) return NextResponse.json({ ok: false, error: 'Could not confirm the payment.' }, { status: 500 });
  return NextResponse.json({ ok: true, courseSlug: r.courseSlug });
}
