import { NextResponse } from 'next/server';
import { bookingStartSchema } from '@/lib/validation';
import { crmEnabled } from '@/lib/crm';
import { stripeEnabled } from '@/lib/stripe';
import { bookingFor } from '@/lib/treatments';
import { encClinical, decClinical } from '@/lib/clinical-crypto';

export const runtime = 'nodejs';

const UPSELL_PCT = 20; // discount on add-ons taken in the same slot

// Account-based booking. The signed-in client picks a catalogue variant (+ any
// upsell add-ons); pricing comes from the CRM with offers + welcome discount
// applied. Saves the card (SetupIntent) only if none is already on file.
export async function POST(req: Request) {
  if (!crmEnabled || !stripeEnabled) {
    return NextResponse.json({ ok: false, error: 'Online booking is not available right now. Please call us.' }, { status: 503 });
  }
  // This endpoint holds real slots and creates Stripe customers/SetupIntents, so
  // throttle it (the live booking path was previously unthrottled).
  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'booking-start', 12, 600, 'client'))) {
    return NextResponse.json({ ok: false, error: 'Too many booking attempts. Please wait a moment and try again.' }, { status: 429 });
  }
  const parsed = bookingStartSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Invalid request' }, { status: 422 });
  const d = parsed.data;

  const { getCurrentClient } = await import('@/lib/client-auth');
  const { withDbRetry } = await import('@/lib/db');
  const client = await getCurrentClient();
  if (!client) return NextResponse.json({ ok: false, error: 'Please create an account or sign in to book.' }, { status: 401 });

  const { getVariant, liveOffers, bestOffer, effectiveStatus, isBookableStatus } = await import('@/lib/services');
  const primary = await withDbRetry(() => getVariant(d.variantId));
  if (!primary) return NextResponse.json({ ok: false, error: 'That service is unavailable. Please choose another.' }, { status: 404 });
  // Effective presentation status governs bookability. Admin status wins; the
  // code-level onRequest flag forces "coming soon" only when status is NORMAL
  // (machine not in yet) — keeping this consistent with the treatment page.
  const { getTreatment } = await import('@/lib/treatments');
  let primaryStatus = effectiveStatus(primary.service.status as 'NORMAL' | 'CONSULTATION' | 'COMING_SOON' | 'UNAVAILABLE', primary.variant.status);
  if (primaryStatus === 'NORMAL' && getTreatment(primary.service.treatmentSlug)?.onRequest) primaryStatus = 'COMING_SOON';
  if (!isBookableStatus(primaryStatus)) {
    return NextResponse.json({ ok: false, error: 'This treatment isn’t available to book online right now — please enquire and we’ll be in touch.' }, { status: 409 });
  }

  const addOns = (await withDbRetry(() => Promise.all(d.addOnVariantIds.map((id) => getVariant(id))))).filter(Boolean) as NonNullable<Awaited<ReturnType<typeof getVariant>>>[];
  const offers = await withDbRetry(() => liveOffers(false));

  const { db } = await import('@/lib/db');

  // ── Build line items + pricing ──
  type Item = { variantId: string; treatmentSlug: string; label: string; sessions: number; durationMin: number; pricePence: number; discountPence: number; isAddon: boolean };
  const items: Item[] = [];

  // Primary — single session or a course (course total when a matching course exists).
  // "On consultation" books as a £0 card-on-file hold; the price is set by staff later.
  const onConsultation = primaryStatus === 'CONSULTATION';
  let base = onConsultation ? 0 : primary.variant.pricePence;
  let sessions = 1;
  if (!onConsultation && d.sessions > 1) {
    const course = primary.variant.courses.find((c) => c.sessions === d.sessions);
    if (course) { base = course.totalPence; sessions = d.sessions; }
  }
  const primaryOffer = bestOffer(offers, primary.service.id, primary.variant.id, base);
  let primaryDiscount = primaryOffer?.discountPence ?? 0;
  let usedWelcome = false;
  const welcomeClaim = base > 0 ? await db.discountClaim.findFirst({ where: { clientId: client.id, status: 'ACTIVE' } }) : null;
  if (welcomeClaim) {
    const w = Math.round((base * welcomeClaim.percent) / 100);
    if (w > primaryDiscount) { primaryDiscount = w; usedWelcome = true; }
  }
  // A promo code applies to the primary treatment and wins if it beats the best
  // automatic discount (no stacking). Validated server-side; redeemed below.
  let promo: { promoId: string } | null = null;
  if (base > 0 && d.promoCode) {
    const { priceWithPromo } = await import('@/lib/promo');
    const r = await priceWithPromo(d.promoCode, { clientId: client.id, email: client.email, treatmentSlug: primary.service.treatmentSlug, pricePence: base });
    if (r.ok && r.discountPence >= primaryDiscount) { primaryDiscount = r.discountPence; usedWelcome = false; promo = { promoId: r.promoId }; }
  }
  items.push({
    variantId: primary.variant.id, treatmentSlug: primary.service.treatmentSlug,
    label: `${primary.service.name} — ${primary.variant.name}`, sessions,
    durationMin: primary.variant.durationMin, pricePence: base, discountPence: primaryDiscount, isAddon: false,
  });

  for (const ao of addOns) {
    if (ao.variant.id === primary.variant.id) continue;
    const aoStatus = effectiveStatus(ao.service.status as 'NORMAL' | 'CONSULTATION' | 'COMING_SOON' | 'UNAVAILABLE', ao.variant.status);
    if (!isBookableStatus(aoStatus)) continue; // coming soon / unavailable can't be added
    const b = aoStatus === 'CONSULTATION' ? 0 : ao.variant.pricePence;
    const off = aoStatus === 'CONSULTATION' ? null : bestOffer(offers, ao.service.id, ao.variant.id, b);
    const discount = Math.max(off?.discountPence ?? 0, Math.round((b * UPSELL_PCT) / 100));
    items.push({
      variantId: ao.variant.id, treatmentSlug: ao.service.treatmentSlug,
      label: `${ao.service.name} — ${ao.variant.name}`, sessions: 1,
      durationMin: ao.variant.durationMin, pricePence: b, discountPence: discount, isAddon: true,
    });
  }

  const totalDuration = items.reduce((s, it) => s + it.durationMin, 0);
  const totalPrice = items.reduce((s, it) => s + Math.max(0, it.pricePence - it.discountPence), 0);

  // ── Validate the slot against the live availability engine ──
  const { isSlotFree, pickPractitioner, assignResources } = await import('@/lib/availability');
  const treatmentSlug = primary.service.treatmentSlug;
  if (!(await withDbRetry(() => isSlotFree(d.startISO, totalDuration, treatmentSlug)))) {
    return NextResponse.json({ ok: false, error: 'That time was just taken. Please choose another slot.' }, { status: 409 });
  }
  const { getSetting } = await import('@/lib/settings');
  const autoAssign = await getSetting('auto_assign_practitioner');
  const practitionerId = autoAssign ? await withDbRetry(() => pickPractitioner(d.startISO, totalDuration, treatmentSlug)) : null;
  const resourceIds = await withDbRetry(() => assignResources(d.startISO, totalDuration, treatmentSlug));

  const { stripe, ensureCustomer } = await import('@/lib/stripe');
  const customerId = await ensureCustomer(client);

  const start = new Date(d.startISO);
  const end = new Date(start.getTime() + totalDuration * 60_000);
  const extra = items.length - 1;
  const title = `${primary.service.name} — ${primary.variant.name}` + (extra > 0 ? ` + ${extra} add-on${extra > 1 ? 's' : ''}` : '');

  // Persist SMS preference if the client opted in during booking.
  const clientUpdate: Record<string, unknown> = {};
  if (d.smsReminders && !client.smsReminders) clientUpdate.smsReminders = true;
  // Persist stated allergies on the client record (latest wins) for safety + hospitality.
  if (d.allergyNote && d.allergyNote.trim() && d.allergyNote.trim() !== (decClinical(client.allergies) || '')) clientUpdate.allergies = encClinical(d.allergyNote.trim());
  if (Object.keys(clientUpdate).length) await db.client.update({ where: { id: client.id }, data: clientUpdate }).catch(() => {});

  // Validate refreshment ids server-side.
  const { isRefreshment } = await import('@/lib/hospitality');
  const refreshments = d.refreshments.filter(isRefreshment);

  // Age gate (cosmetic treatments are 18+): require the declaration tick AND that
  // the client's DOB makes them 18+ on the appointment date.
  if (!d.ageDeclare) {
    return NextResponse.json({ ok: false, error: 'Please confirm you are 18 or over to book a treatment.' }, { status: 400 });
  }
  const { isAdultOn } = await import('@/lib/age');
  const dobRow = await db.client.findUnique({ where: { id: client.id }, select: { dob: true } });
  if (!dobRow?.dob || !isAdultOn(dobRow.dob, start)) {
    return NextResponse.json({ ok: false, error: 'Clinic treatments are available to clients aged 18 or over. Please check the date of birth on your profile.' }, { status: 403 });
  }
  await db.client.update({ where: { id: client.id }, data: { ageDeclaredAt: new Date() } }).catch(() => {});

  const { bookingAttribution } = await import('@/lib/marketing');
  const attribution = await bookingAttribution();

  const booking = await db.booking.create({
    data: {
      clientId: client.id,
      treatmentSlug, treatmentTitle: title,
      startAt: start, endAt: end, durationMin: totalDuration,
      bufferMin: bookingFor(treatmentSlug).bufferMin ?? 0,
      pricePence: totalPrice,
      status: 'PENDING',
      notes: d.notes || null,
      refreshments,
      allergyNote: d.allergyNote?.trim() ? encClinical(d.allergyNote.trim()) : null,
      aftercareAckAt: d.aftercareAck ? new Date() : null,
      stripeCustomerId: customerId,
      practitionerId,
      ...attribution,
      resources: resourceIds.length ? { connect: resourceIds.map((id) => ({ id })) } : undefined,
      items: { create: items },
    },
  });

  // Burn the welcome discount if it was the best offer used.
  if (usedWelcome && welcomeClaim) {
    await db.discountClaim.update({ where: { id: welcomeClaim.id }, data: { status: 'REDEEMED', redeemedBookingId: booking.id } });
  }
  // Record the promo redemption (increments its usage counter).
  if (promo) {
    const { redeemPromo } = await import('@/lib/promo');
    await redeemPromo(promo.promoId, { clientId: client.id, email: client.email, bookingId: booking.id, amountOffPence: primaryDiscount });
  }

  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'BOOKING_CREATED', actor: 'client', clientId: client.id, bookingId: booking.id, summary: `Booking created: ${title} on ${start.toLocaleString('en-GB')}`, meta: { totalPence: totalPrice, items: items.length } });

  // BLD-133: if this booking came from a waitlist claim link, retire the offer.
  if (d.waitlistToken) { const { claimWaitlist } = await import('@/lib/waitlist'); await claimWaitlist(d.waitlistToken, { clientId: client.id }); }

  // ── Card on file: reuse a saved card, else save one via SetupIntent ──
  let defaultPm: string | null = null;
  try {
    const customer = await stripe().customers.retrieve(customerId);
    if (customer && !('deleted' in customer && customer.deleted)) {
      const dpm = (customer as { invoice_settings?: { default_payment_method?: string | { id: string } } }).invoice_settings?.default_payment_method;
      defaultPm = typeof dpm === 'string' ? dpm : dpm?.id ?? null;
    }
  } catch { /* fall through to collecting a card */ }

  if (defaultPm) {
    await db.booking.update({ where: { id: booking.id }, data: { status: 'CONFIRMED', stripePaymentMethodId: defaultPm } });
    await logAudit({ action: 'BOOKING_CONFIRMED', actor: 'client', clientId: client.id, bookingId: booking.id, summary: 'Confirmed with card already on file' });
    const { notifyBookingConfirmed } = await import('@/lib/booking-notify');
    await notifyBookingConfirmed(booking.id);
    return NextResponse.json({ ok: true, bookingId: booking.id, needCard: false, manageToken: booking.manageToken });
  }

  const setupIntent = await stripe().setupIntents.create({
    customer: customerId, usage: 'off_session', payment_method_types: ['card'],
    metadata: { bookingId: booking.id, clientId: client.id },
  });
  await db.booking.update({ where: { id: booking.id }, data: { stripeSetupIntentId: setupIntent.id } });

  return NextResponse.json({ ok: true, bookingId: booking.id, needCard: true, clientSecret: setupIntent.client_secret });
}
