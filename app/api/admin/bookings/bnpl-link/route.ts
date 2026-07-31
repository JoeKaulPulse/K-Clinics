import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { crmEnabled } from '@/lib/crm';
import { stripeEnabled } from '@/lib/stripe';
import { getSession, sessionCan } from '@/lib/auth';

export const runtime = 'nodejs';

// BLD-399 (BLD-409 course context). Staff trigger a Buy-Now-Pay-Later payment
// for a *course* of treatment: the client pays the FULL course price upfront via
// Klarna/Clearpay. BNPL methods can't be saved off-session (so the normal
// card-on-file flow can't be used), so we use Stripe Checkout (hosted) — it
// handles the Klarna/Clearpay redirect, method display and eligibility. We
// return a payment link for staff to send to the client; the webhook marks the
// booking PRE-PAID when the payment_intent succeeds (no card-on-file charge is
// then taken). Staff only (bookings.manage).
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'Not enabled.' }, { status: 503 });
  if (!stripeEnabled) return NextResponse.json({ ok: false, error: 'Payments are not configured.' }, { status: 503 });
  const session = await getSession();
  if (!session || !sessionCan(session, 'bookings.manage')) {
    return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
  }

  const { bookingId } = (await req.json().catch(() => ({}))) as { bookingId?: string };
  if (!bookingId) return NextResponse.json({ ok: false, error: 'Missing booking.' }, { status: 400 });

  const { db } = await import('@/lib/db');
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { client: true } });
  if (!booking) return NextResponse.json({ ok: false, error: 'Booking not found.' }, { status: 404 });
  if (booking.prepaidVia) return NextResponse.json({ ok: false, error: 'This course has already been pre-paid.' }, { status: 409 });
  if (['CANCELLED', 'NO_SHOW'].includes(booking.status)) {
    return NextResponse.json({ ok: false, error: 'This booking is closed.' }, { status: 409 });
  }

  // Full course total in pence — the single source of truth (lib/booking-actions),
  // shared with the webhook validation so the amount paid is checked against the
  // exact figure quoted here.
  const { courseTotalPence } = await import('@/lib/booking-actions');
  const course = await courseTotalPence(bookingId);
  if (!course || course.pence <= 0) {
    return NextResponse.json({ ok: false, error: 'This booking has no payable course total (on-consultation pricing). Set a price first.' }, { status: 409 });
  }
  // BLD-1119: the pre-payment must settle the booking IN FULL. courseTotalPence is
  // the primary line item only, so if the booking price is higher (add-on
  // treatments on top of the course) this link would leave a remainder that no
  // charge surface can then collect — prepaidAt makes every one of them refuse.
  if (booking.pricePence > course.pence) {
    return NextResponse.json({
      ok: false,
      error: `This booking totals £${(booking.pricePence / 100).toFixed(2)} but the course itself is £${(course.pence / 100).toFixed(2)} — the extras on top can’t be collected once the course is pre-paid. Remove the add-on treatments here and bill them on a separate booking, then send the pre-payment link.`,
    }, { status: 409 });
  }
  // BLD-1149: and refuse the mirror case. An admin price override edits
  // Booking.pricePence only — the primary line item (what courseTotalPence
  // reads, and what the course_prepaid webhook validates the payment against)
  // keeps the catalogue price, deliberately, so the override can't leak into a
  // rebooked next visit. Sending the link anyway would bill the client the
  // PRE-override total and mark it paid in full. Fail loudly instead.
  if (booking.pricePence < course.pence) {
    return NextResponse.json({
      ok: false,
      error: `This booking is priced at £${(booking.pricePence / 100).toFixed(2)} but the course line item is still £${(course.pence / 100).toFixed(2)}, and a pre-payment link can only be raised for the course total — it would charge the client £${(course.pence / 100).toFixed(2)}. Take the agreed price on the card on file or a pay-link instead, or re-book the course at that price.`,
    }, { status: 409 });
  }

  const base = (process.env.NEXT_PUBLIC_SITE_URL || (await import('@/lib/site')).site.url).replace(/\/$/, '');
  const name = course.sessions > 1 ? `Course of ${course.sessions} × ${booking.treatmentTitle}` : booking.treatmentTitle;

  try {
    const { stripe, ensureCustomer } = await import('@/lib/stripe');
    // Attach to the client's Stripe customer so the payment shows on their record.
    const customerId = await ensureCustomer(booking.client);
    const checkout = await stripe().checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      line_items: [{ quantity: 1, price_data: { currency: 'gbp', unit_amount: course.pence, product_data: { name } } }],
      // Klarna/Clearpay (and card) are surfaced automatically by hosted Checkout
      // for whatever methods are enabled in the Stripe Dashboard — it decides
      // eligibility per client/amount. (Checkout Sessions have no
      // automatic_payment_methods param; that's a PaymentIntent-only field.)
      // Carry the course-prepaid markers on BOTH the Checkout session and the
      // PaymentIntent: the webhook fires on payment_intent.succeeded, so the PI
      // metadata is what marks the booking PRE-PAID.
      payment_intent_data: { metadata: { kind: 'course_prepaid', bookingId } },
      metadata: { kind: 'course_prepaid', bookingId },
      success_url: `${base}/pos-paid?course=1`,
      cancel_url: `${base}/pos-paid?cancelled=1`,
    }, { idempotencyKey: `course-bnpl-${bookingId}` });

    // Record the Checkout session id for traceability / idempotency.
    await db.booking.update({ where: { id: bookingId }, data: { prepaidCheckoutId: checkout.id } });
    await db.interaction.create({
      data: { clientId: booking.clientId, type: 'APPOINTMENT', summary: `BNPL (Klarna/Clearpay) pre-payment link created for ${name} — £${(course.pence / 100).toFixed(2)}`, author: session.email },
    }).catch(() => {});

    return NextResponse.json({ ok: true, url: checkout.url, amountPence: course.pence, sessions: course.sessions });
  } catch (e) {
    Sentry.captureException(e, { tags: { area: 'admin/bookings/bnpl-link' } });
    return NextResponse.json({ ok: false, error: (e as Error)?.message || 'Could not start the payment link.' }, { status: 400 });
  }
}
