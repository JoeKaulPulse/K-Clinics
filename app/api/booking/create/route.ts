import { NextResponse } from 'next/server';
import { bookingCreateSchema } from '@/lib/validation';
import { crmEnabled } from '@/lib/crm';
import { stripeEnabled } from '@/lib/stripe';
import { getTreatment, bookingFor } from '@/lib/treatments';

export const runtime = 'nodejs';

// Creates a PENDING booking, holds the slot, and returns a SetupIntent client
// secret so the client can save their card (no charge). Confirmed via /confirm.
export async function POST(req: Request) {
  if (!crmEnabled || !stripeEnabled) {
    return NextResponse.json({ ok: false, error: 'Online booking is not available right now. Please call us.' }, { status: 503 });
  }

  const parsed = bookingCreateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.errors[0]?.message || 'Invalid request' }, { status: 422 });
  }
  const d = parsed.data;
  if (d.company) return NextResponse.json({ ok: true }); // honeypot

  const treatment = getTreatment(d.slug);
  if (!treatment) return NextResponse.json({ ok: false, error: 'Unknown treatment' }, { status: 404 });

  const { pricePence, durationMin } = bookingFor(d.slug);
  const start = new Date(d.startISO);
  const end = new Date(start.getTime() + durationMin * 60_000);

  const { db } = await import('@/lib/db');
  const { isSlotFree } = await import('@/lib/availability');
  const { stripe, ensureCustomer } = await import('@/lib/stripe');

  if (!(await isSlotFree(d.startISO, durationMin))) {
    return NextResponse.json({ ok: false, error: 'That time was just taken. Please choose another slot.' }, { status: 409 });
  }

  // Upsert client + Stripe customer.
  const client = await db.client.upsert({
    where: { email: d.email.toLowerCase() },
    update: { firstName: d.firstName, lastName: d.lastName || undefined, phone: d.phone || undefined, marketingOptIn: d.marketingOptIn || undefined },
    create: {
      firstName: d.firstName, lastName: d.lastName || null, email: d.email.toLowerCase(),
      phone: d.phone || null, source: 'website-booking', marketingOptIn: d.marketingOptIn,
    },
  });
  const customerId = await ensureCustomer(client);

  // Hold the slot.
  const booking = await db.booking.create({
    data: {
      clientId: client.id,
      treatmentSlug: d.slug,
      treatmentTitle: treatment.title,
      startAt: start, endAt: end, durationMin,
      pricePence: pricePence ?? 0,
      status: 'PENDING',
      notes: d.notes || null,
      stripeCustomerId: customerId,
    },
  });

  // SetupIntent — saves the card off-session, no charge.
  const setupIntent = await stripe().setupIntents.create({
    customer: customerId,
    usage: 'off_session',
    payment_method_types: ['card'],
    metadata: { bookingId: booking.id, clientId: client.id },
  });

  await db.booking.update({ where: { id: booking.id }, data: { stripeSetupIntentId: setupIntent.id } });

  return NextResponse.json({ ok: true, bookingId: booking.id, clientSecret: setupIntent.client_secret });
}
