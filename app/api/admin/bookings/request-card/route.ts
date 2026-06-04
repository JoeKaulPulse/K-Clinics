import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';
import { stripeEnabled } from '@/lib/stripe';

export const runtime = 'nodejs';

// Staff send the client a secure link to save a card to an offline booking
// (phone / walk-in), so it gets the same no-show / late-cancel protection as an
// online booking. No charge is taken — the link only stores the card.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'Not enabled.' }, { status: 503 });
  if (!stripeEnabled) return NextResponse.json({ ok: false, error: 'Payments are not configured.' }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('bookings.charge');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const { bookingId, channel } = (await req.json().catch(() => ({}))) as { bookingId?: string; channel?: 'email' | 'sms' | 'both' };
  if (!bookingId) return NextResponse.json({ ok: false, error: 'Missing booking.' }, { status: 400 });

  const { db } = await import('@/lib/db');
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { client: true } });
  if (!booking) return NextResponse.json({ ok: false, error: 'Booking not found.' }, { status: 404 });
  if (booking.stripePaymentMethodId) return NextResponse.json({ ok: false, error: 'A card is already saved for this booking.' }, { status: 409 });
  if (['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(booking.status)) {
    return NextResponse.json({ ok: false, error: 'This booking is closed.' }, { status: 409 });
  }

  // Ensure a Stripe customer exists for the client and is linked to the booking.
  const { ensureCustomer } = await import('@/lib/stripe');
  const customerId = await ensureCustomer(booking.client);
  if (!booking.stripeCustomerId) {
    await db.booking.update({ where: { id: booking.id }, data: { stripeCustomerId: customerId } });
  }

  const base = (process.env.NEXT_PUBLIC_SITE_URL || (await import('@/lib/site')).site.url).replace(/\/$/, '');
  const url = `${base}/booking/card?t=${booking.manageToken}`;
  const want = channel || 'email';

  const sent: string[] = [];
  if (want === 'email' || want === 'both') {
    const { sendEmail, tmplCardRequest } = await import('@/lib/email');
    const r = await sendEmail({
      to: booking.client.email,
      subject: 'Save a card to confirm your appointment — KClinics',
      html: tmplCardRequest({ firstName: booking.client.firstName, treatment: booking.treatmentTitle, start: booking.startAt, url }),
    });
    if (r.ok) sent.push('email');
  }
  if (want === 'sms' || want === 'both') {
    const { sendSms } = await import('@/lib/sms');
    const r = await sendSms(booking.client.phone, `KClinics: please save a card to confirm your appointment (no payment taken now): ${url}`);
    if (r.ok) sent.push('sms');
  }

  if (sent.length === 0) {
    return NextResponse.json({ ok: false, error: 'Could not send the link (check the client has an email/phone).', url }, { status: 400 });
  }

  await db.interaction.create({ data: { clientId: booking.clientId, type: 'APPOINTMENT', summary: `Card-on-file link sent (${sent.join(', ')}) for ${booking.treatmentTitle}`, author: session.email } }).catch(() => {});

  return NextResponse.json({ ok: true, sent, url });
}
