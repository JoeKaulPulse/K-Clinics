'use server';

import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan } from '@/lib/auth';
import { bookingFor, getTreatment } from '@/lib/treatments';

// Staff: create a booking manually (phone / walk-in). No card is taken here;
// staff charge on delivery from the booking detail page. Marked CONFIRMED.
export async function createManualBooking(input: {
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  treatmentSlug: string;
  startISO: string;
  notes?: string;
}) {
  if (!crmEnabled) return { ok: false, error: 'CRM disabled' };
  const session = await getSession();
  if (!session || !sessionCan(session, 'bookings.manage')) {
    return { ok: false, error: 'You don’t have permission to create bookings.' };
  }
  const treatment = getTreatment(input.treatmentSlug);
  if (!treatment) return { ok: false, error: 'Unknown treatment.' };
  if (!input.email || !input.firstName || !input.startISO) return { ok: false, error: 'Name, email and time are required.' };
  const start = new Date(input.startISO);
  if (isNaN(+start)) return { ok: false, error: 'Invalid date/time.' };

  const { pricePence, durationMin, bufferMin } = bookingFor(input.treatmentSlug);
  const end = new Date(start.getTime() + durationMin * 60000);

  const { db } = await import('@/lib/db');
  // Hold any room/equipment the treatment needs (best-effort; staff can override).
  const { assignResources } = await import('@/lib/availability');
  const resourceIds = await assignResources(input.startISO, durationMin, input.treatmentSlug);
  const client = await db.client.upsert({
    where: { email: input.email.toLowerCase() },
    update: {
      firstName: input.firstName,
      lastName: input.lastName || undefined,
      phone: input.phone || undefined,
    },
    create: {
      firstName: input.firstName,
      lastName: input.lastName || null,
      email: input.email.toLowerCase(),
      phone: input.phone || null,
      source: 'staff-booking',
    },
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
      resources: resourceIds.length ? { connect: resourceIds.map((id) => ({ id })) } : undefined,
    },
  });
  await db.interaction.create({
    data: { clientId: client.id, type: 'APPOINTMENT', summary: `Booking created by staff: ${treatment.title}`, author: session.email },
  });

  revalidatePath('/admin/bookings');
  return { ok: true, bookingId: booking.id };
}
