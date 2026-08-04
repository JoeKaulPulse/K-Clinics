import { NextResponse } from 'next/server';
import { z } from 'zod';
import * as Sentry from '@sentry/nextjs';
import { crmEnabled } from '@/lib/crm';
import { stripeEnabled } from '@/lib/stripe';

export const runtime = 'nodejs';
export const maxDuration = 30;

const schema = z.object({ bookingId: z.string().min(1), clientSecret: z.string().min(1).optional() });

// Called after Stripe Elements confirms the SetupIntent. Verifies the saved
// payment method, marks the booking CONFIRMED and sends confirmation emails.
export async function POST(req: Request) {
  if (!crmEnabled || !stripeEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  // Wall-clock start, so the best-effort tail below can be capped against what's
  // left of maxDuration rather than a fixed figure that could overrun it.
  const startedAt = Date.now();
  // BLD-700: rate-limit so booking IDs can't be probed at volume. The funnel
  // is anonymous (guests book without an account), so ownership is proven by
  // possession of the SetupIntent client secret below, not a session.
  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'booking-confirm', 10, 300))) {
    return NextResponse.json({ ok: false, error: 'Too many attempts — wait a few minutes.' }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 422 });

  const { db } = await import('@/lib/db');
  const { stripe } = await import('@/lib/stripe');

  let booking;
  try {
    booking = await db.booking.findUnique({ where: { id: parsed.data.bookingId }, include: { client: true } });
  } catch (err) {
    console.error('[booking/confirm] DB read failed:', (err as Error)?.message);
    Sentry.captureException(err, { tags: { route: 'booking/confirm', stage: 'db-read' } });
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }
  if (!booking) return NextResponse.json({ ok: false, error: 'Booking not found' }, { status: 404 });
  if (booking.status === 'CONFIRMED') return NextResponse.json({ ok: true, already: true });
  if (!booking.stripeSetupIntentId) return NextResponse.json({ ok: false, error: 'No setup intent' }, { status: 400 });

  let si;
  try {
    si = await stripe().setupIntents.retrieve(booking.stripeSetupIntentId);
  } catch (err) {
    console.error('[booking/confirm] Stripe retrieve failed:', (err as Error)?.message);
    Sentry.captureException(err, { tags: { route: 'booking/confirm', stage: 'stripe-retrieve' } });
    return NextResponse.json({ ok: false, error: 'Payment provider unavailable' }, { status: 502 });
  }
  if (si.status !== 'succeeded' || !si.payment_method) {
    return NextResponse.json({ ok: false, error: 'Card not confirmed' }, { status: 400 });
  }
  // BLD-700 / PRJ-1032.3: proof of possession — only the browser that ran the
  // Elements flow holds the SetupIntent client secret, so a matching secret ties
  // the confirm to the actual payer (works for guests, no session needed). The
  // secret is now REQUIRED: the pre-deploy funnel sessions it used to exempt have
  // long since aged out, so an absent secret is treated as a probe and refused
  // (previously it was allowed-but-reported, which let a guessed bookingId flip
  // to CONFIRMED and fire the client email by simply omitting the field).
  if (!parsed.data.clientSecret || parsed.data.clientSecret !== si.client_secret) {
    return NextResponse.json({ ok: false, error: 'Not your booking session.' }, { status: 403 });
  }
  const pmId = typeof si.payment_method === 'string' ? si.payment_method : si.payment_method.id;

  // Make this PM the customer default for future off-session charges.
  try {
    await stripe().customers.update(booking.stripeCustomerId!, { invoice_settings: { default_payment_method: pmId } });
  } catch (err) {
    console.error('[booking/confirm] Stripe customer update failed:', (err as Error)?.message);
    Sentry.captureException(err, { tags: { route: 'booking/confirm', stage: 'stripe-customer-update' } });
    return NextResponse.json({ ok: false, error: 'Payment provider unavailable' }, { status: 502 });
  }

  try {
    await db.booking.update({
      where: { id: booking.id },
      data: { status: 'CONFIRMED', stripePaymentMethodId: pmId },
    });
  } catch (err) {
    console.error('[booking/confirm] DB update failed:', (err as Error)?.message);
    Sentry.captureException(err, { tags: { route: 'booking/confirm', stage: 'db-update' } });
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  // Best-effort notifications; capped at 15 s so a provider hang never causes a 504.
  // The booking is already CONFIRMED — the daily cron covers any deferred sends.
  const { notifyBookingConfirmed } = await import('@/lib/booking-notify');
  await Promise.race([
    notifyBookingConfirmed(booking.id),
    new Promise<void>((_, reject) => setTimeout(() => reject(new Error('notify timeout')), 15_000)),
  ]).catch((err) => console.warn('[booking/confirm] notification timeout or error:', (err as Error)?.message));

  // Push to the shared clinic calendar (Hostinger CalDAV) and mirror onto the
  // assigned clinician's Google Calendar (both no-op until configured). Awaited
  // rather than fired and forgotten — a bare import().then() can be frozen
  // mid-flight once the response is sent on Vercel's serverless runtime,
  // silently dropping the sync (the same bug already fixed for the ops-alert
  // webhook, BLD-1137).
  //
  // The wait is capped at 10s AND at whatever is left of maxDuration (30s) with
  // headroom to send the response: the notify step above can itself burn 15s, so
  // a flat 10s here could push the handler past the function limit and turn a
  // booking that IS confirmed into a 504 at the last step of the funnel. If the
  // budget runs out we return and let the calls finish (or not) in the
  // background — the pre-BLD-1166 behaviour, but only under duress.
  const calendarBudgetMs = Math.min(10_000, Math.max(1_000, 26_000 - (Date.now() - startedAt)));
  let calendarTimer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    Promise.allSettled([
      import('@/lib/hostinger-calendar').then((m) => m.pushBooking(booking.id)),
      import('@/lib/google-calendar').then((m) => m.pushBookingToClinician(booking.id)),
    ]),
    new Promise<void>((resolve) => { calendarTimer = setTimeout(resolve, calendarBudgetMs); }),
  ]).finally(() => { if (calendarTimer) clearTimeout(calendarTimer); });

  return NextResponse.json({ ok: true, manageToken: booking.manageToken });
}
