import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { bookingCreateSchema } from '@/lib/validation';
import { crmEnabled } from '@/lib/crm';
import { stripeEnabled } from '@/lib/stripe';
import { getTreatment, bookingFor } from '@/lib/treatments';
import { CLINIC_TZ } from '@/lib/clinic-time';

export const runtime = 'nodejs';

// Creates a PENDING booking, holds the slot, and returns a SetupIntent client
// secret so the client can save their card (no charge). Confirmed via /confirm.
export async function POST(req: Request) {
  if (!crmEnabled || !stripeEnabled) {
    return NextResponse.json({ ok: false, error: 'Online booking is not available right now. Please call us.' }, { status: 503 });
  }

  // This endpoint is public and holds a real slot + creates a Stripe customer
  // and SetupIntent, so rate-limit by IP to prevent slot-holding spam / abuse.
  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'booking-create', 12, 600, 'client'))) {
    return NextResponse.json({ ok: false, error: 'Too many booking attempts. Please wait a moment and try again, or call us.' }, { status: 429 });
  }

  const parsed = bookingCreateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Invalid request' }, { status: 422 });
  }
  const d = parsed.data;
  if (d.company) return NextResponse.json({ ok: true }); // honeypot

  const treatment = getTreatment(d.slug);
  if (!treatment) return NextResponse.json({ ok: false, error: 'Unknown treatment' }, { status: 404 });

  // Everything below touches the DB. Wrap it so a transient blip during a deploy
  // / cold start surfaces a clear, retryable message instead of an opaque 500 —
  // and retry the idempotent *reads* so most blips are invisible. (Writes are not
  // retried; on failure we return 503 and the client can safely try again.)
  const { withDbRetry } = await import('@/lib/db');
  try {
  const { durationMin, bufferMin } = bookingFor(d.slug);
  const { pricingForTreatment, isBookableStatus } = await import('@/lib/services');
  const pricing = await withDbRetry(() => pricingForTreatment(d.slug));
  // Effective status: admin status wins; onRequest forces "coming soon" only when
  // status is NORMAL — consistent with the treatment page + the account flow.
  let status = pricing?.status ?? 'NORMAL';
  if (status === 'NORMAL' && treatment.onRequest) status = 'COMING_SOON';
  if (!isBookableStatus(status)) {
    return NextResponse.json({ ok: false, error: 'This treatment isn’t available to book online right now — please enquire and we’ll be in touch.' }, { status: 409 });
  }
  // "On consultation" books as a £0 card-on-file hold; staff price it later.
  const pricePence = status === 'CONSULTATION' ? 0 : (pricing?.fromPence ?? null);
  const start = new Date(d.startISO);
  const end = new Date(start.getTime() + durationMin * 60_000);

  // Age gate: the client must be 18+ on the appointment date.
  const { isAdultOn } = await import('@/lib/age');
  if (!isAdultOn(d.dob, start)) {
    return NextResponse.json({ ok: false, error: 'Clinic treatments are available to clients aged 18 or over.' }, { status: 403 });
  }

  const { db } = await import('@/lib/db');
  const { isSlotFree, pickPractitioner, assignResources } = await import('@/lib/availability');
  const { stripe, ensureCustomer } = await import('@/lib/stripe');
  const { getSetting } = await import('@/lib/settings');

  // A waitlist claim link may offer a same-day slot inside the public 2h lead;
  // relax the lead only for that genuine, still-live offer (BLD-336).
  const { claimLeadOpts } = await import('@/lib/waitlist');
  const leadOpts = await claimLeadOpts(d.waitlistToken, d.startISO);
  if (!(await withDbRetry(() => isSlotFree(d.startISO, durationMin, d.slug, null, leadOpts)))) {
    return NextResponse.json({ ok: false, error: 'That time was just taken. Please choose another slot.' }, { status: 409 });
  }

  // Auto-assign a competent, available clinician if enabled, and hold any
  // room/equipment the treatment requires.
  const autoAssign = await getSetting('auto_assign_practitioner');
  const practitionerId = autoAssign ? await withDbRetry(() => pickPractitioner(d.startISO, durationMin, d.slug)) : null;
  const resourceIds = await withDbRetry(() => assignResources(d.startISO, durationMin, d.slug));

  // Upsert client + Stripe customer.
  const { marketingConsentFields } = await import('@/lib/consent');
  const client = await db.client.upsert({
    where: { email: d.email.toLowerCase() },
    update: {
      firstName: d.firstName, lastName: d.lastName || undefined, phone: d.phone || undefined, dob: new Date(d.dob), ageDeclaredAt: new Date(),
      marketingOptIn: d.marketingOptIn || undefined,
      // BLD-128: evidence consent when opt-in is explicitly given.
      ...(d.marketingOptIn ? marketingConsentFields('website-booking') : {}),
    },
    create: {
      firstName: d.firstName, lastName: d.lastName || null, email: d.email.toLowerCase(),
      phone: d.phone || null, dob: new Date(d.dob), ageDeclaredAt: new Date(), source: 'website-booking', marketingOptIn: d.marketingOptIn,
      ...(d.marketingOptIn ? marketingConsentFields('website-booking') : {}),
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

  // Hold the slot — ATOMICALLY. Re-check for overlapping holds inside a
  // Serializable transaction (mirrors redeemPromo/awardClientPoints) so two
  // concurrent requests can't both book the same clinician / room / equipment:
  // Postgres SSI aborts the loser, and an explicit clash check rejects a
  // concurrent grab of the same precomputed practitioner/resource. ALL reads use
  // `tx` (one connection) so this is safe under the serverless connection_limit=1.
  const { bookingAttribution } = await import('@/lib/marketing');
  const attribution = await bookingAttribution();
  const endBuffered = new Date(end.getTime() + (bufferMin ?? 0) * 60_000);
  let booking: { id: string } | null = null;
  try {
    booking = await db.$transaction(async (tx) => {
      const overlapping = await tx.booking.findMany({
        where: { status: { in: ['PENDING', 'CONFIRMED'] }, startAt: { lt: endBuffered }, endAt: { gt: start } },
        select: { practitionerId: true, resources: { select: { id: true } } },
      });
      const practitionerClash = !!practitionerId && overlapping.some((b) => b.practitionerId === practitionerId);
      const resourceClash = resourceIds.length > 0 && overlapping.some((b) => b.resources.some((r) => resourceIds.includes(r.id)));
      if (practitionerClash || resourceClash) return null;
      return tx.booking.create({
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
          ...attribution,
          resources: resourceIds.length ? { connect: resourceIds.map((id) => ({ id })) } : undefined,
        },
        select: { id: true },
      });
    }, { isolationLevel: 'Serializable' });
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === 'P2034' || /write conflict|deadlock|could not serialize/i.test(err.message || '')) {
      return NextResponse.json({ ok: false, error: 'That time was just taken. Please choose another slot.' }, { status: 409 });
    }
    throw e;
  }
  if (!booking) {
    return NextResponse.json({ ok: false, error: 'That time was just taken. Please choose another slot.' }, { status: 409 });
  }

  // Immutable audit: booking created (+ assignment if auto-assigned).
  const { logAudit } = await import('@/lib/audit');
  await logAudit({
    action: 'BOOKING_CREATED', actor: 'client', clientId: client.id, bookingId: booking.id,
    summary: `Booking created: ${treatment.title} on ${start.toLocaleString('en-GB', { timeZone: CLINIC_TZ })}`,
    meta: { treatmentSlug: d.slug, pricePence: finalPrice },
  });
  if (practitionerId) {
    await logAudit({ action: 'PRACTITIONER_ASSIGNED', actor: 'system', bookingId: booking.id, clientId: client.id, summary: 'Clinician auto-assigned' });
  }

  // BLD-133: if this booking came from a waitlist claim link, retire the offer.
  if (d.waitlistToken) { const { claimWaitlist } = await import('@/lib/waitlist'); await claimWaitlist(d.waitlistToken, { clientId: client.id }); }

  // Staff incentive: reward the practitioner of the client's previous treatment
  // for securing this repeat booking (best-effort).
  try { const { awardForRebooking } = await import('@/lib/gamification'); await awardForRebooking(booking.id); } catch { /* non-fatal */ }

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

  // SetupIntent — saves the card off-session, no charge. The booking is already
  // committed (PENDING) above, and lib/availability.ts treats PENDING bookings as
  // slot-blocking indefinitely — so an unguarded Stripe failure here would leave a
  // dangling held slot with no code path to release it (BLD-737). Mirrors the
  // recovery pattern in app/api/booking/start/route.ts.
  try {
    const setupIntent = await stripe().setupIntents.create({
      customer: customerId,
      usage: 'off_session',
      payment_method_types: ['card'],
      metadata: { bookingId: booking.id, clientId: client.id },
    }, { idempotencyKey: `setup-${booking.id}` });

    await db.booking.update({ where: { id: booking.id }, data: { stripeSetupIntentId: setupIntent.id } });

    return NextResponse.json({ ok: true, bookingId: booking.id, clientSecret: setupIntent.client_secret });
  } catch (e) {
    console.error('[booking/create] card setup could not start for', booking.id, e);
    Sentry.captureException(e, { tags: { route: 'booking/create', stage: 'setup-intent' } });
    const se = e as { message?: string; code?: string; type?: string };
    const reason = [se.type, se.code, se.message].filter(Boolean).join(' · ').slice(0, 300) || 'unknown error';
    // Release the held slot (CANCELLED is excluded from the held-slot checks) so a
    // failed attempt doesn't block the time, then return a clean, actionable error.
    await db.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' } }).catch(() => {});
    await logAudit({ action: 'BOOKING_CANCELLED', actor: 'system', clientId: client.id, bookingId: booking.id, summary: `Auto-cancelled: secure card setup could not start — ${reason}` }).catch(() => {});
    return NextResponse.json({ ok: false, error: 'We couldn’t start secure card setup. Please try again in a moment.' }, { status: 502 });
  }
  } catch (e) {
    console.error('[booking/create] failed:', (e as Error)?.message);
    Sentry.captureException(e, { tags: { area: 'booking/create' } });
    return NextResponse.json({ ok: false, error: 'We couldn’t hold your slot just now — please try again in a moment, or call us.' }, { status: 503 });
  }
}
