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
  startISO: string;
  notes?: string;
  override?: boolean;
}) {
  if (!crmEnabled) return { ok: false, error: 'CRM disabled' };
  const session = await getSession();
  if (!session || !sessionCan(session, 'bookings.manage')) {
    return { ok: false, error: 'You don’t have permission to create bookings.' };
  }
  const treatment = getTreatment(input.treatmentSlug);
  if (!treatment) return { ok: false, error: 'Unknown treatment.' };
  if (!input.startISO) return { ok: false, error: 'Choose a time.' };
  if (!input.clientId && (!input.email || !input.firstName)) return { ok: false, error: 'Name and email are required for a new client.' };
  const start = new Date(input.startISO);
  if (isNaN(+start)) return { ok: false, error: 'Invalid date/time.' };

  const { durationMin, bufferMin } = bookingFor(input.treatmentSlug);
  const { lowestPenceForTreatment } = await import('@/lib/services');
  const pricePence = await lowestPenceForTreatment(input.treatmentSlug);
  const end = new Date(start.getTime() + durationMin * 60000);

  const { db } = await import('@/lib/db');
  const { isSlotFree, assignResources, pickPractitioner } = await import('@/lib/availability');
  // Guard against double-booking a room/clinician (unless explicitly overridden).
  // Reception books same-day phone/walk-in appointments, so the public 2-hour
  // lead window must NOT apply here; a small grace also lets staff log a client
  // who has just arrived.
  const PAST_GRACE_MIN = 15;
  if (!input.override && start.getTime() < Date.now() - PAST_GRACE_MIN * 60_000) {
    return { ok: false, error: 'That time has already passed — pick a time from now onwards, or tick “book anyway” to record a back-dated booking.', clash: true };
  }
  if (!input.override && !(await isSlotFree(input.startISO, durationMin, input.treatmentSlug, undefined, { leadMinutes: -PAST_GRACE_MIN }))) {
    return { ok: false, error: 'That slot clashes with an existing appointment or closure, falls outside opening hours, or has no free room/clinician. Tick “book anyway” to override.', clash: true };
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
      treatmentTitle: treatment.title,
      startAt: start,
      endAt: end,
      durationMin,
      bufferMin: bufferMin ?? 0,
      pricePence: pricePence ?? 0,
      status: 'CONFIRMED',
      notes: input.notes || null,
      practitionerId,
      resources: resourceIds.length ? { connect: resourceIds.map((id) => ({ id })) } : undefined,
    },
  });
  await db.interaction.create({
    data: { clientId: client.id, type: 'APPOINTMENT', summary: `Booking created by staff: ${treatment.title}`, author: session.email },
  });

  // Staff incentive: reward the prior practitioner for a secured repeat booking.
  try { const { awardForRebooking } = await import('@/lib/gamification'); await awardForRebooking(booking.id); } catch { /* non-fatal */ }

  const hasCard = !!(await db.booking.findFirst({ where: { clientId: client.id, stripePaymentMethodId: { not: null } }, select: { id: true } }));

  revalidatePath('/admin/bookings');
  return { ok: true, bookingId: booking.id, manageToken: booking.manageToken, hasCard, clientFirstName: client.firstName, clientEmail: client.email, clientHasEmail: !!client.email };
}
