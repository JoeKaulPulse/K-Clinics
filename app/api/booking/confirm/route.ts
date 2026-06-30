import { NextResponse } from 'next/server';
import { z } from 'zod';
import { crmEnabled } from '@/lib/crm';
import { stripeEnabled } from '@/lib/stripe';

export const runtime = 'nodejs';
export const maxDuration = 30;

const schema = z.object({ bookingId: z.string().min(1) });

// Called after Stripe Elements confirms the SetupIntent. Verifies the saved
// payment method, marks the booking CONFIRMED and sends confirmation emails.
export async function POST(req: Request) {
  if (!crmEnabled || !stripeEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 422 });

  // BLD-700: rate-limit to prevent booking ID enumeration / SetupIntent probing.
  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'booking-confirm', 10, 600))) {
    return NextResponse.json({ ok: false, error: 'Too many requests. Please wait a moment and try again.' }, { status: 429 });
  }

  // BLD-700: resolve the signed-in client so we can enforce ownership below.
  const { getCurrentClient } = await import('@/lib/client-auth');
  const client = await getCurrentClient();

  const { db } = await import('@/lib/db');
  const { stripe } = await import('@/lib/stripe');

  let booking;
  try {
    booking = await db.booking.findUnique({ where: { id: parsed.data.bookingId }, include: { client: true } });
  } catch (err) {
    console.error('[booking/confirm] DB read failed:', (err as Error)?.message);
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }
  if (!booking) return NextResponse.json({ ok: false, error: 'Booking not found' }, { status: 404 });

  // BLD-700: ownership check — only the booking's owner may confirm it.
  if (!client) return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  if (booking.clientId !== client.id) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
  if (booking.status === 'CONFIRMED') return NextResponse.json({ ok: true, already: true });
  if (!booking.stripeSetupIntentId) return NextResponse.json({ ok: false, error: 'No setup intent' }, { status: 400 });

  let si;
  try {
    si = await stripe().setupIntents.retrieve(booking.stripeSetupIntentId);
  } catch (err) {
    console.error('[booking/confirm] Stripe retrieve failed:', (err as Error)?.message);
    return NextResponse.json({ ok: false, error: 'Payment provider unavailable' }, { status: 502 });
  }
  if (si.status !== 'succeeded' || !si.payment_method) {
    return NextResponse.json({ ok: false, error: 'Card not confirmed' }, { status: 400 });
  }
  const pmId = typeof si.payment_method === 'string' ? si.payment_method : si.payment_method.id;

  // Make this PM the customer default for future off-session charges.
  try {
    await stripe().customers.update(booking.stripeCustomerId!, { invoice_settings: { default_payment_method: pmId } });
  } catch (err) {
    console.error('[booking/confirm] Stripe customer update failed:', (err as Error)?.message);
    return NextResponse.json({ ok: false, error: 'Payment provider unavailable' }, { status: 502 });
  }

  try {
    await db.booking.update({
      where: { id: booking.id },
      data: { status: 'CONFIRMED', stripePaymentMethodId: pmId },
    });
  } catch (err) {
    console.error('[booking/confirm] DB update failed:', (err as Error)?.message);
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  // Best-effort notifications; capped at 15 s so a provider hang never causes a 504.
  // The booking is already CONFIRMED — the daily cron covers any deferred sends.
  const { notifyBookingConfirmed } = await import('@/lib/booking-notify');
  await Promise.race([
    notifyBookingConfirmed(booking.id),
    new Promise<void>((_, reject) => setTimeout(() => reject(new Error('notify timeout')), 15_000)),
  ]).catch((err) => console.warn('[booking/confirm] notification timeout or error:', (err as Error)?.message));

  // Push to the shared clinic calendar (Hostinger CalDAV; no-op until configured).
  import('@/lib/hostinger-calendar').then((m) => m.pushBooking(booking.id)).catch(() => {});
  // Mirror onto the assigned clinician's Google Calendar (no-op while parked).
  import('@/lib/google-calendar').then((m) => m.pushBookingToClinician(booking.id)).catch(() => {});

  return NextResponse.json({ ok: true, manageToken: booking.manageToken });
}
