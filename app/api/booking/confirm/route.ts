import { NextResponse } from 'next/server';
import { z } from 'zod';
import { crmEnabled } from '@/lib/crm';
import { stripeEnabled } from '@/lib/stripe';

export const runtime = 'nodejs';

const schema = z.object({ bookingId: z.string().min(1) });

// Called after Stripe Elements confirms the SetupIntent. Verifies the saved
// payment method, marks the booking CONFIRMED and sends confirmation emails.
export async function POST(req: Request) {
  if (!crmEnabled || !stripeEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 422 });

  const { db } = await import('@/lib/db');
  const { stripe } = await import('@/lib/stripe');

  const booking = await db.booking.findUnique({ where: { id: parsed.data.bookingId }, include: { client: true } });
  if (!booking) return NextResponse.json({ ok: false, error: 'Booking not found' }, { status: 404 });
  if (booking.status === 'CONFIRMED') return NextResponse.json({ ok: true, already: true });
  if (!booking.stripeSetupIntentId) return NextResponse.json({ ok: false, error: 'No setup intent' }, { status: 400 });

  const si = await stripe().setupIntents.retrieve(booking.stripeSetupIntentId);
  if (si.status !== 'succeeded' || !si.payment_method) {
    return NextResponse.json({ ok: false, error: 'Card not confirmed' }, { status: 400 });
  }
  const pmId = typeof si.payment_method === 'string' ? si.payment_method : si.payment_method.id;

  // Make this PM the customer default for future off-session charges.
  await stripe().customers.update(booking.stripeCustomerId!, { invoice_settings: { default_payment_method: pmId } });

  await db.booking.update({
    where: { id: booking.id },
    data: { status: 'CONFIRMED', stripePaymentMethodId: pmId },
  });

  // Centralised confirmation comms (client + clinic email, SMS, forms prompt).
  const { notifyBookingConfirmed } = await import('@/lib/booking-notify');
  await notifyBookingConfirmed(booking.id);

  // Push to the shared clinic calendar (Hostinger CalDAV; no-op until configured).
  import('@/lib/hostinger-calendar').then((m) => m.pushBooking(booking.id)).catch(() => {});

  return NextResponse.json({ ok: true, manageToken: booking.manageToken });
}
