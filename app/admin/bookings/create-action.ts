'use server';

import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan } from '@/lib/auth';
import { bookingFor, getTreatment } from '@/lib/treatments';

/** Search existing clients for the phone-booking flow (name / email / phone),
 *  flagging whether each already has a card on file. */
export async function searchClientsForBooking(q: string) {
  if (!crmEnabled) return { ok: false as const, clients: [] };
  const session = await getSession();
  if (!session || !sessionCan(session, 'bookings.manage')) return { ok: false as const, clients: [] };
  const term = (q || '').trim();
  if (term.length < 2) return { ok: true as const, clients: [] };
  const { db } = await import('@/lib/db');
  const ci = { contains: term, mode: 'insensitive' as const };
  const rows = await db.client.findMany({
    where: { OR: [{ firstName: ci }, { lastName: ci }, { email: ci }, { phone: { contains: term } }] },
    orderBy: { updatedAt: 'desc' }, take: 6,
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, dob: true, bookings: { where: { stripePaymentMethodId: { not: null } }, select: { id: true }, take: 1 } },
  });
  return { ok: true as const, clients: rows.map((c) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone, hasDob: !!c.dob, hasCard: c.bookings.length > 0 })) };
}

// Staff: create a booking manually (phone / walk-in). No card is taken here —
// the client is sent a secure link to save one. Existing client (by clientId)
// or a new one (by details). Returns manageToken + whether a card's on file.
export async function createManualBooking(input: {
  clientId?: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  treatmentSlug: string;
  variantId?: string;
  /** Book this treatment category as a consultation (BLD-208): 30 min, £0. */
  asConsultation?: boolean;
  startISO: string;
  notes?: string;
  override?: boolean;
}) {
  if (!crmEnabled) return { ok: false, error: 'CRM disabled' };
  const session = await getSession();
  if (!session || !sessionCan(session, 'bookings.manage')) {
    return { ok: false, error: 'You don’t have permission to create bookings.' };
  }
  // "Consultation" is a reserved pseudo-treatment (not in the marketing catalogue)
  // so staff can book an in-clinic consultation appointment for a new client
  // (BLD-203): 30 minutes, on-consultation (£0), any free room/clinician.
  const isConsultation = input.treatmentSlug === 'consultation';
  const treatment = isConsultation ? null : getTreatment(input.treatmentSlug);
  if (!isConsultation && !treatment) return { ok: false, error: 'Unknown treatment.' };
  if (!input.startISO) return { ok: false, error: 'Choose a time.' };
  if (!input.clientId && (!input.email || !input.firstName)) return { ok: false, error: 'Name and email are required for a new client.' };
  const start = new Date(input.startISO);
  if (isNaN(+start)) return { ok: false, error: 'Invalid date/time.' };
  // BLD-192: staff bookings must NOT inherit the public 2-hour online lead window
  // — reception books same-day and just-arrived clients all the time. We only
  // block times more than 15 minutes in the past (unless "book anyway" is ticked),
  // with a clear message instead of the misleading "clash" error.
  const STAFF_PAST_GRACE_MIN = 15;
  if (!input.override && start.getTime() < Date.now() - STAFF_PAST_GRACE_MIN * 60_000) {
    return { ok: false, error: 'That time has already passed. Choose a current or future time, or tick “book anyway” to log a past appointment.' };
  }

  // A treatment category (e.g. "Laser Hair Removal") has specific service
  // variants/areas (Underarms, Full Legs…), each with its own duration + price.
  // When the booker picks one, use ITS duration/price and record a billing line
  // item; otherwise fall back to the category's generic duration + "from" price.
  // A consultation booking — the standalone "Consultation" (BLD-203) OR any
  // treatment category booked as a consultation (BLD-208) — is 30 min, £0.
  const consultBooking = isConsultation || (!!treatment && !!input.asConsultation);
  const { durationMin: baseDuration, bufferMin } = bookingFor(input.treatmentSlug);
  let durationMin = baseDuration;
  let pricePence: number | null = null;
  let bookingTitle = treatment?.title ?? 'Consultation';
  let itemLabel = treatment?.title ?? 'Consultation';
  let chosenVariantId: string | null = null;
  const { getVariant, lowestPenceForTreatment } = await import('@/lib/services');
  const variant = !consultBooking && input.variantId ? await getVariant(input.variantId) : null;
  if (consultBooking) {
    durationMin = 30;
    pricePence = 0;
    bookingTitle = treatment ? `${treatment.title} — Consultation` : 'Consultation';
    itemLabel = bookingTitle;
  } else if (variant && treatment && variant.service.treatmentSlug === input.treatmentSlug) {
    durationMin = variant.variant.durationMin || baseDuration;
    pricePence = variant.variant.pricePence;
    bookingTitle = `${treatment.title} — ${variant.variant.name}`;
    itemLabel = bookingTitle;
    chosenVariantId = variant.variant.id;
  } else {
    pricePence = await lowestPenceForTreatment(input.treatmentSlug);
  }
  const end = new Date(start.getTime() + durationMin * 60000);

  const { db } = await import('@/lib/db');
  const { isSlotFree, assignResources, pickPractitioner } = await import('@/lib/availability');
  // Guard against double-booking a room/clinician (unless explicitly overridden).
  // Staff get the 15-minute past grace (negative lead) — the real clash, closure
  // and room/clinician checks below are unchanged.
  if (!input.override && !(await isSlotFree(input.startISO, durationMin, input.treatmentSlug, null, { leadMinutes: -STAFF_PAST_GRACE_MIN }))) {
    return { ok: false, error: 'That slot clashes with an existing appointment, closure, or has no free room/clinician. Tick “book anyway” to override.', clash: true };
  }
  // Assign a competent, available clinician (so it shows in their day) + hold resources.
  const practitionerId = await pickPractitioner(input.startISO, durationMin, input.treatmentSlug);
  const resourceIds = await assignResources(input.startISO, durationMin, input.treatmentSlug);
  const client = input.clientId
    ? await db.client.update({ where: { id: input.clientId }, data: { phone: input.phone || undefined, lastName: input.lastName || undefined } })
    : await db.client.upsert({
        where: { email: input.email.toLowerCase() },
        update: { firstName: input.firstName, lastName: input.lastName || undefined, phone: input.phone || undefined },
        create: { firstName: input.firstName, lastName: input.lastName || null, email: input.email.toLowerCase(), phone: input.phone || null, source: 'staff-booking' },
      });

  const booking = await db.booking.create({
    data: {
      clientId: client.id,
      treatmentSlug: input.treatmentSlug,
      treatmentTitle: bookingTitle,
      startAt: start,
      endAt: end,
      durationMin,
      bufferMin: bufferMin ?? 0,
      pricePence: pricePence ?? 0,
      status: 'CONFIRMED',
      notes: input.notes || null,
      practitionerId,
      resources: resourceIds.length ? { connect: resourceIds.map((id) => ({ id })) } : undefined,
      // Primary line item so the itemised receipt + billing reflect the exact
      // service/area chosen (not just the category).
      items: { create: [{ variantId: chosenVariantId, treatmentSlug: input.treatmentSlug, label: itemLabel, sessions: 1, durationMin, pricePence: pricePence ?? 0, isAddon: false }] },
    },
  });
  await db.interaction.create({
    data: { clientId: client.id, type: 'APPOINTMENT', summary: `Booking created by staff: ${bookingTitle}`, author: session.email },
  });

  // Staff incentive: reward the prior practitioner for a secured repeat booking.
  try { const { awardForRebooking } = await import('@/lib/gamification'); await awardForRebooking(booking.id); } catch { /* non-fatal */ }

  const hasCard = !!(await db.booking.findFirst({ where: { clientId: client.id, stripePaymentMethodId: { not: null } }, select: { id: true } }));

  revalidatePath('/admin/bookings');
  return { ok: true, bookingId: booking.id, manageToken: booking.manageToken, hasCard, clientFirstName: client.firstName, clientEmail: client.email, clientHasEmail: !!client.email };
}
