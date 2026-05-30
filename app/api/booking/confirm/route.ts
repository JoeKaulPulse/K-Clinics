import { NextResponse } from 'next/server';
import { z } from 'zod';
import { crmEnabled } from '@/lib/crm';
import { stripeEnabled } from '@/lib/stripe';
import { site } from '@/lib/site';

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
  const { sendEmail, tmplBookingConfirmation, tmplBookingNotify } = await import('@/lib/email');

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
  await db.interaction.create({
    data: { clientId: booking.clientId, type: 'APPOINTMENT', summary: `Booked ${booking.treatmentTitle}`, detail: booking.startAt.toISOString(), author: 'system' },
  });

  const manageUrl = `${process.env.NEXT_PUBLIC_SITE_URL || site.url}/booking/manage?t=${booking.manageToken}`;
  const name = [booking.client.firstName, booking.client.lastName].filter(Boolean).join(' ');
  const notifyTo = process.env.CLINIC_NOTIFY_EMAIL || site.email;

  await Promise.all([
    sendEmail({ to: booking.client.email, subject: `Your booking is confirmed — ${booking.treatmentTitle}`, html: tmplBookingConfirmation({ firstName: booking.client.firstName, treatment: booking.treatmentTitle, start: booking.startAt, pricePence: booking.pricePence, manageUrl }) }),
    sendEmail({ to: notifyTo, subject: `New booking — ${name}`, html: tmplBookingNotify({ name, email: booking.client.email, phone: booking.client.phone || undefined, treatment: booking.treatmentTitle, start: booking.startAt, pricePence: booking.pricePence }) }),
  ]);
  await db.emailEvent.create({ data: { clientId: booking.clientId, kind: 'MANUAL', to: booking.client.email, subject: 'Booking confirmation', status: 'SENT' } });

  return NextResponse.json({ ok: true, manageToken: booking.manageToken });
}
