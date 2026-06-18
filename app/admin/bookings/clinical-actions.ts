'use server';

import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan } from '@/lib/auth';

// Save the clinician's treatment note for a session (encrypted at rest).
// Requires clinical access. Append-only in spirit: each save stamps author/time
// and writes an audit entry.
export async function saveClinicalNote(bookingId: string, note: string) {
  if (!crmEnabled) return { ok: false };
  const session = await getSession();
  if (!session || !sessionCan(session, 'clients.clinical.view')) return { ok: false, error: 'Not permitted' };
  const { db } = await import('@/lib/db');
  const { encryptJson } = await import('@/lib/crypto');
  const { logAudit } = await import('@/lib/audit');
  const trimmed = note.trim();
  const b = await db.booking.update({
    where: { id: bookingId },
    data: {
      clinicalNoteEnc: trimmed ? encryptJson({ note: trimmed }) : null,
      clinicalNoteBy: session.email,
      clinicalNoteAt: new Date(),
    },
    select: { clientId: true },
  });
  await logAudit({ action: 'NOTE_ADDED', actor: session.email, actorRole: session.role, bookingId, clientId: b.clientId, summary: 'Clinical treatment note saved' });
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { ok: true };
}

// Add a treatment (service variant) to an appointment mid-session. Creates an
// add-on line item AND raises the booking's price + duration, so the eventual
// charge and the itemised receipt both reflect it. Blocked once the booking is
// charged or cancelled (the money's already settled / the slot is void).
export async function addTreatmentToBooking(bookingId: string, variantId: string) {
  if (!crmEnabled) return { ok: false, error: 'CRM disabled' };
  const session = await getSession();
  if (!session || !sessionCan(session, 'bookings.manage')) return { ok: false, error: 'Not permitted' };
  if (!variantId) return { ok: false, error: 'Choose a treatment to add.' };
  const { db } = await import('@/lib/db');
  const { logAudit } = await import('@/lib/audit');

  const booking = await db.booking.findUnique({ where: { id: bookingId }, select: { status: true, chargedAt: true, clientId: true } });
  if (!booking) return { ok: false, error: 'Booking not found.' };
  if (booking.chargedAt) return { ok: false, error: 'This appointment is already paid — add the treatment to a new booking instead.' };
  if (booking.status === 'CANCELLED' || booking.status === 'NO_SHOW') return { ok: false, error: 'This appointment is cancelled.' };

  const { getVariant } = await import('@/lib/services');
  const v = await getVariant(variantId);
  if (!v) return { ok: false, error: 'That treatment is unavailable.' };
  const label = `${v.service.name} — ${v.variant.name}`;

  // Line item + roll the price/duration into the booking in one transaction.
  await db.$transaction([
    db.bookingItem.create({
      data: {
        bookingId, variantId, treatmentSlug: v.service.treatmentSlug, label,
        pricePence: v.variant.pricePence, durationMin: v.variant.durationMin, isAddon: true,
      },
    }),
    db.booking.update({
      where: { id: bookingId },
      data: { pricePence: { increment: v.variant.pricePence }, durationMin: { increment: v.variant.durationMin } },
    }),
  ]);
  await logAudit({ action: 'SESSION_EDITED', actor: session.email, actorRole: session.role, bookingId, clientId: booking.clientId, summary: `Added ${label} (+£${(v.variant.pricePence / 100).toFixed(2)})` });
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath(`/admin/bookings/${bookingId}/session`);
  return { ok: true };
}

// Remove an add-on treatment from an appointment (before charge). Only
// removes items where isAddon: true — the primary treatment is never touched.
// Decrements the booking price + duration in the same transaction.
export async function removeAddonTreatment(bookingId: string, itemId: string) {
  if (!crmEnabled) return { ok: false, error: 'CRM disabled' };
  const session = await getSession();
  if (!session || !sessionCan(session, 'bookings.manage')) return { ok: false, error: 'Not permitted' };
  if (!bookingId || !itemId) return { ok: false, error: 'Missing booking or item ID.' };
  const { db } = await import('@/lib/db');
  const { logAudit } = await import('@/lib/audit');

  const booking = await db.booking.findUnique({ where: { id: bookingId }, select: { chargedAt: true, clientId: true, status: true } });
  if (!booking) return { ok: false, error: 'Booking not found.' };
  if (booking.chargedAt) return { ok: false, error: 'This appointment is already paid — the add-on cannot be removed.' };
  if (booking.status === 'CANCELLED' || booking.status === 'NO_SHOW') return { ok: false, error: 'This appointment is cancelled.' };

  const item = await db.bookingItem.findUnique({ where: { id: itemId }, select: { isAddon: true, label: true, pricePence: true, durationMin: true, bookingId: true } });
  if (!item) return { ok: false, error: 'Item not found.' };
  if (item.bookingId !== bookingId) return { ok: false, error: 'Item does not belong to this booking.' };
  if (!item.isAddon) return { ok: false, error: 'Only add-on treatments can be removed.' };

  await db.$transaction([
    db.bookingItem.delete({ where: { id: itemId } }),
    db.booking.update({
      where: { id: bookingId },
      data: { pricePence: { decrement: item.pricePence }, durationMin: { decrement: item.durationMin } },
    }),
  ]);
  await logAudit({ action: 'SESSION_EDITED', actor: session.email, actorRole: session.role, bookingId, clientId: booking.clientId, summary: `Removed add-on ${item.label} (-£${(item.pricePence / 100).toFixed(2)})` });
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath(`/admin/bookings/${bookingId}/session`);
  return { ok: true };
}

// Clinician confirms they've reviewed the SOP for this appointment.
export async function acknowledgeSop(bookingId: string) {
  if (!crmEnabled) return { ok: false };
  const session = await getSession();
  if (!session || !sessionCan(session, 'bookings.manage')) return { ok: false, error: 'Not permitted' };
  const { db } = await import('@/lib/db');
  const { logAudit } = await import('@/lib/audit');
  await db.booking.update({ where: { id: bookingId }, data: { sopAcknowledgedAt: new Date(), sopAcknowledgedBy: session.email } });
  await logAudit({ action: 'SOP_ACKNOWLEDGED', actor: session.email, actorRole: session.role, bookingId, summary: 'SOP reviewed & acknowledged' });
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { ok: true };
}

// Save the SOP checklist: which steps are checked + any captured client
// responses. Encrypted at rest. When every step is checked the SOP counts as
// acknowledged (so the start-gate clears). Audit-logged.
export async function saveSopChecklist(
  bookingId: string,
  items: { step: string; checked: boolean; response?: string }[],
  allChecked: boolean,
) {
  if (!crmEnabled) return { ok: false };
  const session = await getSession();
  if (!session || !sessionCan(session, 'bookings.manage')) return { ok: false, error: 'Not permitted' };
  const { db } = await import('@/lib/db');
  const { encryptJson } = await import('@/lib/crypto');
  const { logAudit } = await import('@/lib/audit');
  await db.booking.update({
    where: { id: bookingId },
    data: {
      sopChecklistEnc: encryptJson({ items, completedAt: allChecked ? new Date().toISOString() : null }),
      // Acknowledging requires every step ticked.
      ...(allChecked ? { sopAcknowledgedAt: new Date(), sopAcknowledgedBy: session.email } : { sopAcknowledgedAt: null }),
    },
  });
  await logAudit({
    action: 'SOP_ACKNOWLEDGED', actor: session.email, actorRole: session.role, bookingId,
    summary: allChecked ? 'SOP checklist completed' : 'SOP checklist updated',
  });
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { ok: true };
}

// Clinician confirms they've reviewed the client's medical flag.
export async function reviewMedicalFlag(bookingId: string) {
  if (!crmEnabled) return { ok: false };
  const session = await getSession();
  if (!session || !sessionCan(session, 'bookings.manage')) return { ok: false, error: 'Not permitted' };
  const { db } = await import('@/lib/db');
  const { logAudit } = await import('@/lib/audit');
  const b = await db.booking.update({ where: { id: bookingId }, data: { medicalFlagReviewedAt: new Date(), medicalFlagReviewedBy: session.email } });
  await logAudit({ action: 'MEDICAL_FLAG_REVIEWED', actor: session.email, actorRole: session.role, bookingId, clientId: b.clientId, summary: 'Client medical flag reviewed' });
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { ok: true };
}

// Start the appointment clock — gated by required pre-checks.
export async function startAppointment(bookingId: string) {
  if (!crmEnabled) return { ok: false };
  const session = await getSession();
  if (!session || !sessionCan(session, 'bookings.manage')) return { ok: false, error: 'Not permitted' };

  const { db } = await import('@/lib/db');
  const { getSetting } = await import('@/lib/settings');
  const { logAudit } = await import('@/lib/audit');

  const b = await db.booking.findUnique({ where: { id: bookingId }, include: { client: { select: { medicalFlag: true } } } });
  if (!b) return { ok: false, error: 'Not found' };

  // Enforce pre-checks.
  if ((await getSetting('require_sop_ack')) && !b.sopAcknowledgedAt) {
    return { ok: false, error: 'Please acknowledge the treatment SOP before starting.' };
  }
  if ((await getSetting('require_medical_review')) && b.client.medicalFlag && !b.medicalFlagReviewedAt) {
    return { ok: false, error: 'Please review the client’s medical flag before starting.' };
  }
  // Consent gate: a signed treatment consent must exist for this appointment.
  if (await getSetting('require_consent')) {
    const consent = await db.signedConsent.findFirst({ where: { bookingId, kind: 'treatment' }, select: { id: true } });
    if (!consent) return { ok: false, error: 'The client must sign the treatment consent form before starting.' };
  }
  // Laser before-photo gate (insurance-critical): a before-photo OR a signed
  // photo opt-out must be on file for laser treatments.
  const { isLaserTreatment } = await import('@/lib/consent');
  if (isLaserTreatment(b.treatmentSlug) && (await getSetting('require_before_photo'))) {
    const [photo, optOut] = await Promise.all([
      db.beforePhoto.findFirst({ where: { bookingId }, select: { id: true } }),
      db.signedConsent.findFirst({ where: { bookingId, kind: 'photo_opt_out' }, select: { id: true } }),
    ]);
    if (!photo && !optOut) return { ok: false, error: 'Capture a before photo (or have the client sign the photo opt-out) before starting this laser treatment.' };
  }

  await db.booking.update({ where: { id: bookingId }, data: { startedAt: new Date() } });
  await logAudit({ action: 'APPOINTMENT_STARTED', actor: session.email, actorRole: session.role, bookingId, clientId: b.clientId, summary: 'Appointment started (clock running)' });
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { ok: true };
}

// Record a consumable used during this appointment — deducts stock, links the
// movement to the booking (batch traceability) and writes the immutable log.
export async function recordConsumable(bookingId: string, itemId: string, qty: number, batchNo?: string) {
  if (!crmEnabled) return { ok: false };
  const session = await getSession();
  if (!session || !sessionCan(session, 'bookings.manage')) return { ok: false, error: 'Not permitted' };
  if (!itemId || !qty || qty <= 0) return { ok: false, error: 'Enter a quantity.' };
  const { db } = await import('@/lib/db');
  const { logAudit } = await import('@/lib/audit');
  const b = await db.booking.findUnique({ where: { id: bookingId }, select: { clientId: true } });
  const item = await db.stockItem.findUnique({ where: { id: itemId }, select: { name: true, unit: true } });
  if (!b || !item) return { ok: false, error: 'Not found' };
  await db.$transaction([
    db.stockMovement.create({ data: { itemId, delta: -Math.abs(qty), reason: 'USED', bookingId, batchNo: batchNo?.trim() || null, by: session.email } }),
    db.stockItem.update({ where: { id: itemId }, data: { currentQty: { decrement: Math.abs(qty) } } }),
  ]);
  await logAudit({ action: 'CONSUMABLE_USED', actor: session.email, actorRole: session.role, bookingId, clientId: b.clientId, summary: `Used ${qty} ${item.unit} of ${item.name}${batchNo ? ` (batch ${batchNo})` : ''}` });
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { ok: true };
}

// Undo a consumable line (restores stock). Only the movement for this booking.
export async function removeConsumable(movementId: string, bookingId: string) {
  if (!crmEnabled) return { ok: false };
  const session = await getSession();
  if (!session || !sessionCan(session, 'bookings.manage')) return { ok: false, error: 'Not permitted' };
  const { db } = await import('@/lib/db');
  const m = await db.stockMovement.findUnique({ where: { id: movementId }, select: { itemId: true, delta: true, bookingId: true } });
  if (!m || m.bookingId !== bookingId) return { ok: false, error: 'Not found' };
  await db.$transaction([
    db.stockMovement.delete({ where: { id: movementId } }),
    db.stockItem.update({ where: { id: m.itemId }, data: { currentQty: { increment: -m.delta } } }),
  ]);
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { ok: true };
}

// Finish the appointment — stamps actual duration and marks COMPLETED.
export async function finishAppointment(bookingId: string) {
  if (!crmEnabled) return { ok: false };
  const session = await getSession();
  if (!session || !sessionCan(session, 'bookings.manage')) return { ok: false, error: 'Not permitted' };
  const { db } = await import('@/lib/db');
  const { logAudit } = await import('@/lib/audit');
  const b = await db.booking.findUnique({ where: { id: bookingId } });
  if (!b) return { ok: false, error: 'Not found' };
  if (!b.startedAt) return { ok: false, error: 'Start the appointment before finishing it.' };
  if (b.finishedAt) return { ok: true };
  const finishedAt = new Date();
  const actualMinutes = Math.max(1, Math.round((finishedAt.getTime() - b.startedAt.getTime()) / 60000));
  await db.booking.update({ where: { id: bookingId }, data: { finishedAt, actualMinutes, status: 'COMPLETED' } });
  await db.client.update({ where: { id: b.clientId }, data: { lastVisitAt: finishedAt } });
  await logAudit({ action: 'APPOINTMENT_COMPLETED', actor: session.email, actorRole: session.role, bookingId, clientId: b.clientId, summary: `Appointment completed${actualMinutes ? ` (${actualMinutes} min actual vs ${b.durationMin} booked)` : ''}` });

  // Post-treatment review request (best-effort — never blocks finishing).
  try {
    const { getSetting } = await import('@/lib/settings');
    if (await getSetting('review_requests_enabled')) {
      const { ensureReviewRequest, sendReviewRequest } = await import('@/lib/review-system');
      const review = await ensureReviewRequest(bookingId);
      if (review) {
        await sendReviewRequest(review.id, 'EMAIL');
        await logAudit({ action: 'REVIEW_REQUESTED', actor: session.email, actorRole: session.role, bookingId, clientId: b.clientId, summary: 'Review request sent' });
      }
    }
  } catch (e) {
    console.error('[finishAppointment] review request failed (continuing):', (e as Error)?.message);
  }

  // Staff gamification: efficiency + low-waste points (best-effort).
  try {
    const { awardForCompletedAppointment } = await import('@/lib/gamification');
    await awardForCompletedAppointment(bookingId);
  } catch (e) {
    console.error('[finishAppointment] points award failed (continuing):', (e as Error)?.message);
  }
  // Client loyalty: credit spend points (best-effort, idempotent).
  try {
    const { awardClientSpend } = await import('@/lib/client-loyalty');
    await awardClientSpend(bookingId);
  } catch (e) {
    console.error('[finishAppointment] loyalty award failed (continuing):', (e as Error)?.message);
  }

  revalidatePath(`/admin/bookings/${bookingId}`);
  return { ok: true, actualMinutes };
}
