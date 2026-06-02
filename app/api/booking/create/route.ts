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
  if (treatment.onRequest) return NextResponse.json({ ok: false, error: 'This treatment is available on request only — please enquire and we’ll arrange it for you.' }, { status: 409 });

  const { pricePence, durationMin, bufferMin } = bookingFor(d.slug);
  const start = new Date(d.startISO);
  const end = new Date(start.getTime() + durationMin * 60_000);

  const { db } = await import('@/lib/db');
  const { isSlotFree, pickPractitioner, assignResources } = await import('@/lib/availability');
  const { stripe, ensureCustomer } = await import('@/lib/stripe');
  const { getSetting } = await import('@/lib/settings');

  if (!(await isSlotFree(d.startISO, durationMin, d.slug))) {
    return NextResponse.json({ ok: false, error: 'That time was just taken. Please choose another slot.' }, { status: 409 });
  }

  // Auto-assign a competent, available clinician if enabled, and hold any
  // room/equipment the treatment requires.
  const autoAssign = await getSetting('auto_assign_practitioner');
  const practitionerId = autoAssign ? await pickPractitioner(d.startISO, durationMin, d.slug) : null;
  const resourceIds = await assignResources(d.startISO, durationMin, d.slug);

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

  const basePrice = pricePence ?? 0;
  let finalPrice = basePrice;

  // A valid promo code takes precedence over the one-time welcome claim (no
  // stacking). Validated server-side here; redeemed after the booking is held.
  let promo: { promoId: string; discountPence: number } | null = null;
  if (basePrice > 0 && d.promoCode) {
    const { priceWithPromo } = await import('@/lib/promo');
    const r = await priceWithPromo(d.promoCode, { clientId: client.id, email: client.email, treatmentSlug: d.slug, pricePence: basePrice });
    if (r.ok) { finalPrice = r.finalPence; promo = { promoId: r.promoId, discountPence: r.discountPence }; }
  }

  // One-time welcome discount: apply only if no promo code was used.
  const claim =
    !promo && finalPrice > 0 ? await db.discountClaim.findFirst({ where: { clientId: client.id, status: 'ACTIVE' } }) : null;
  if (claim) finalPrice = Math.round((finalPrice * (100 - claim.percent)) / 100);

  // Hold the slot.
  const booking = await db.booking.create({
    data: {
      clientId: client.id,
      treatmentSlug: d.slug,
      treatmentTitle: treatment.title,
      startAt: start, endAt: end, durationMin,
      bufferMin: bufferMin ?? 0,
      pricePence: finalPrice,
      status: 'PENDING',
      notes: d.notes || null,
      stripeCustomerId: customerId,
      practitionerId,
      resources: resourceIds.length ? { connect: resourceIds.map((id) => ({ id })) } : undefined,
    },
  });

  // Immutable audit: booking created (+ assignment if auto-assigned).
  const { logAudit } = await import('@/lib/audit');
  await logAudit({
    action: 'BOOKING_CREATED', actor: 'client', clientId: client.id, bookingId: booking.id,
    summary: `Booking created: ${treatment.title} on ${start.toLocaleString('en-GB')}`,
    meta: { treatmentSlug: d.slug, pricePence: finalPrice },
  });
  if (practitionerId) {
    await logAudit({ action: 'PRACTITIONER_ASSIGNED', actor: 'system', bookingId: booking.id, clientId: client.id, summary: 'Clinician auto-assigned' });
  }

  // Record the promo redemption (increments the code's usage counter).
  if (promo) {
    const { redeemPromo } = await import('@/lib/promo');
    await redeemPromo(promo.promoId, { clientId: client.id, email: client.email, bookingId: booking.id, amountOffPence: promo.discountPence });
  }

  // Burn the welcome discount so it can only ever be used once.
  if (claim) {
    await db.discountClaim.update({
      where: { id: claim.id },
      data: { status: 'REDEEMED', redeemedBookingId: booking.id },
    });
  }

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
