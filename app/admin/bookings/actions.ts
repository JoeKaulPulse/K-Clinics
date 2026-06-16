'use server';

import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan } from '@/lib/auth';
import { site } from '@/lib/site';

// Set which location an appointment takes place at (multi-location).
export async function setBookingLocation(bookingId: string, locationId: string | null) {
  if (!crmEnabled) return { ok: false };
  const session = await getSession();
  if (!session || !sessionCan(session, 'bookings.manage')) return { ok: false, error: 'Not permitted' };
  const { db } = await import('@/lib/db');
  await db.booking.update({ where: { id: bookingId }, data: { locationId: locationId || null } });
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { ok: true };
}

// Staff: charge the saved card for a delivered service (adjustable amount).
export async function chargeBookingAction(bookingId: string, amountPence: number, opts?: { discountReason?: string; originalPence?: number }) {
  if (!crmEnabled) return { ok: false, error: 'CRM disabled' };
  const session = await getSession();
  if (!session) return { ok: false, error: 'Unauthorised' };
  if (!sessionCan(session, 'bookings.charge')) return { ok: false, error: 'You don’t have permission to take payments.' };
  if (!Number.isFinite(amountPence) || amountPence < 0) return { ok: false, error: 'Invalid amount' };

  const { db } = await import('@/lib/db');
  const { chargeBooking } = await import('@/lib/booking-actions');
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { client: true } });
  if (!booking) return { ok: false, error: 'Not found' };
  if (booking.chargedAt) return { ok: false, error: 'Already charged' };
  // Safety gateway: only ever take payment for a delivered treatment. The booking
  // must be marked COMPLETED first — this prevents charging a client before (or
  // instead of) their service. (Late-cancellation / no-show fees go through the
  // separate cancel flow and are unaffected.)
  if (booking.status !== 'COMPLETED') {
    return { ok: false, error: 'Mark the appointment as completed before taking payment.' };
  }
  // Fat-finger guard: an off-session charge goes straight through with no client
  // approval, so cap the amount well above any realistic add-on/discount but far
  // below a missing-decimal typo. 4× the booked price, or £5,000 for
  // on-consultation (£0) bookings where the assessed amount is set here.
  const ceilingPence = booking.pricePence > 0 ? booking.pricePence * 4 : 500_000;
  if (amountPence > ceilingPence) {
    return { ok: false, error: `That amount looks too high for this booking (max £${Math.round(ceilingPence / 100)}). Please double-check the figure.` };
  }
  // Compliance gate: never take payment unless the client-facing clinical
  // requirements are on file. This also closes the "Mark completed → charge"
  // shortcut, which sets COMPLETED without the Start workflow's gates — so a
  // client could otherwise be charged with no consent / before-photo recorded.
  const { getSetting } = await import('@/lib/settings');
  if (await getSetting('require_consent')) {
    const consent = await db.signedConsent.findFirst({ where: { bookingId, kind: 'treatment' } });
    if (!consent) return { ok: false, error: 'Capture the signed treatment consent before taking payment.' };
  }
  const { isLaserTreatment } = await import('@/lib/consent');
  if (isLaserTreatment(booking.treatmentSlug) && (await getSetting('require_before_photo'))) {
    const [photoCount, optOut] = await Promise.all([
      db.beforePhoto.count({ where: { bookingId } }),
      db.signedConsent.findFirst({ where: { bookingId, kind: 'photo_opt_out' } }),
    ]);
    if (photoCount === 0 && !optOut) return { ok: false, error: 'Capture a before photo (or take a signed opt-out) before taking payment.' };
  }

  const res = await chargeBooking(booking, Math.round(amountPence), { late: false });
  const { logAudit } = await import('@/lib/audit');
  if (res.ok) {
    // BLD-207: record any ad-hoc price adjustment / discount + reason, immutably.
    const disc = opts?.discountReason?.trim()
      ? ` (price adjustment — ${opts.discountReason.trim()}${opts.originalPence && opts.originalPence > amountPence ? `; was £${(opts.originalPence / 100).toFixed(2)}` : ''})`
      : '';
    await db.interaction.create({ data: { clientId: booking.clientId, type: 'APPOINTMENT', summary: `Charged £${(amountPence / 100).toFixed(2)} for ${booking.treatmentTitle}${disc}`, author: session.email } });
    await logAudit({ action: 'PAYMENT_CHARGED', actor: session.email, actorRole: session.role, bookingId, clientId: booking.clientId, summary: `Charged £${(amountPence / 100).toFixed(2)}${disc}` });
    // The charged amount is the truest spend signal — credit loyalty points
    // (idempotent: a no-op if completion already awarded them).
    try {
      const { awardClientSpend } = await import('@/lib/client-loyalty');
      await awardClientSpend(bookingId);
    } catch (e) {
      console.error('[bookings] loyalty on charge failed:', (e as Error)?.message);
    }
    // Staff profitability points: revenue delivered + add-on upsells (best-effort).
    try {
      const { awardForCharge } = await import('@/lib/gamification');
      await awardForCharge(bookingId);
    } catch (e) {
      console.error('[bookings] staff revenue points failed:', (e as Error)?.message);
    }
    // Report the sale to GA4 + Meta server-side (best-effort; hashed email only).
    try {
      const { sendPurchase } = await import('@/lib/conversions');
      await sendPurchase({ bookingId, valuePence: amountPence, clientId: booking.clientId, email: booking.client?.marketingOptIn ? (booking.client?.email ?? null) : null, campaign: booking.attribCampaign, gclid: booking.gclid });
    } catch (e) {
      console.error('[bookings] conversion send failed:', (e as Error)?.message);
    }
  } else {
    await logAudit({ action: 'PAYMENT_FAILED', actor: session.email, actorRole: session.role, bookingId, clientId: booking.clientId, summary: `Charge failed: ${res.error || 'unknown'}` });
  }
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath('/admin/bookings');
  return res.ok ? { ok: true } : { ok: false, error: res.requiresAction ? 'Card needs authentication — client emailed a confirm link.' : res.error };
}

// Staff: refund a charged booking (full or partial) within the allowed window.
export async function refundBookingAction(bookingId: string, amountPence: number, reason?: string) {
  if (!crmEnabled) return { ok: false, error: 'CRM disabled' };
  const session = await getSession();
  if (!session) return { ok: false, error: 'Unauthorised' };
  if (!sessionCan(session, 'bookings.charge')) return { ok: false, error: 'You don’t have permission to issue refunds.' };
  if (!Number.isFinite(amountPence) || amountPence <= 0) return { ok: false, error: 'Enter an amount to refund.' };

  const { db } = await import('@/lib/db');
  const { refundBooking } = await import('@/lib/booking-actions');
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { client: true } });
  if (!booking) return { ok: false, error: 'Not found' };

  const res = await refundBooking(booking, Math.round(amountPence), { reason: reason?.slice(0, 500), actor: session.email });
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath('/admin/bookings');
  return res;
}

// Approve a same-day appointment request: re-checks availability (the slot may have
// been taken since the request came in), confirms the booking and notifies the
// client. Staff only. Decline uses the normal cancelBookingAction.
export async function approveBookingRequestAction(bookingId: string): Promise<{ ok: boolean; error?: string; clash?: boolean }> {
  if (!crmEnabled) return { ok: false, error: 'CRM disabled' };
  const session = await getSession();
  if (!session || !sessionCan(session, 'bookings.manage')) return { ok: false, error: 'You don’t have permission to manage bookings.' };
  const { db } = await import('@/lib/db');
  const b = await db.booking.findUnique({ where: { id: bookingId }, select: { status: true, clientId: true, startAt: true, durationMin: true, treatmentSlug: true, locationId: true } });
  if (!b) return { ok: false, error: 'Booking not found.' };
  if (b.status !== 'REQUESTED') return { ok: false, error: 'This request has already been actioned.' };
  const { isSlotFree } = await import('@/lib/availability');
  // Staff are confirming same-day, so no online lead window applies — but the room
  // and clinician must still be genuinely free right now.
  const free = await isSlotFree(b.startAt.toISOString(), b.durationMin, b.treatmentSlug, b.locationId, { leadMinutes: 0 });
  if (!free) return { ok: false, error: 'That time is no longer free. Reschedule with the client, or decline the request.', clash: true };
  await db.booking.update({ where: { id: bookingId }, data: { status: 'CONFIRMED' } });
  await db.interaction.create({ data: { clientId: b.clientId, type: 'APPOINTMENT', summary: 'Same-day request approved', author: session.email } });
  try { const { notifyBookingConfirmed } = await import('@/lib/booking-notify'); await notifyBookingConfirmed(bookingId); } catch { /* best-effort */ }
  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'BOOKING_CONFIRMED', actor: session.email, actorRole: session.role, clientId: b.clientId, bookingId, summary: 'Same-day request approved' });
  revalidatePath(`/admin/bookings/${bookingId}`); revalidatePath('/admin/bookings');
  return { ok: true };
}

export async function setBookingStatus(bookingId: string, status: 'COMPLETED' | 'NO_SHOW' | 'CONFIRMED'): Promise<{ ok: boolean; error?: string }> {
  if (!crmEnabled) return { ok: false, error: 'CRM disabled' };
  const session = await getSession();
  if (!session || !sessionCan(session, 'bookings.manage')) return { ok: false, error: 'You don’t have permission to update appointments.' };
  const { db } = await import('@/lib/db');
  await db.booking.update({ where: { id: bookingId }, data: { status } });
  const b = await db.booking.findUnique({ where: { id: bookingId } });
  if (b) {
    await db.interaction.create({ data: { clientId: b.clientId, type: 'APPOINTMENT', summary: `Booking marked ${status.toLowerCase().replace('_', ' ')}`, author: session.email } });
    if (status === 'NO_SHOW') {
      // Warm rebooking note (opt-in). Care-class, deduped once per booking.
      try {
        const { getSetting } = await import('@/lib/settings');
        if (await getSetting('no_show_notice')) {
          const client = await db.client.findUnique({ where: { id: b.clientId }, select: { email: true, firstName: true, unsubscribed: true } });
          const already = await db.emailEvent.findFirst({ where: { kind: 'NO_SHOW', status: 'SENT', meta: { path: ['bookingId'], equals: b.id } } });
          if (client?.email && !client.unsubscribed && !already) {
            const base = (process.env.NEXT_PUBLIC_SITE_URL || site.url).replace(/\/$/, '');
            const { sendEmail, tmplNoShow } = await import('@/lib/email');
            const res = await sendEmail({ to: client.email, subject: `Sorry we missed you — rebook your ${b.treatmentTitle}`, html: tmplNoShow({ firstName: client.firstName, treatment: b.treatmentTitle, start: b.startAt, rebookUrl: `${base}/book?treatment=${encodeURIComponent(b.treatmentSlug)}`, feePence: b.chargedPence }) });
            await db.emailEvent.create({ data: { clientId: b.clientId, kind: 'NO_SHOW', to: client.email, subject: `No-show rebooking — ${b.treatmentTitle}`, status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error, meta: { bookingId: b.id } } }).catch(() => {});
          }
        }
      } catch (e) {
        console.error('[bookings] no-show notice failed:', (e as Error)?.message);
      }
      // Let the diary know a client didn't show (the staff member who marked it is skipped).
      try {
        const { notifyStaffByPermission } = await import('@/lib/notifications');
        await notifyStaffByPermission('bookings.manage', { kind: 'status', category: 'bookings', priority: 'normal', title: `No-show: ${b.treatmentTitle}`, body: b.startAt.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), href: `/admin/bookings/${b.id}` }, session.email);
      } catch { /* non-fatal */ }
    }
    if (status === 'COMPLETED') {
      await db.client.update({ where: { id: b.clientId }, data: { lastVisitAt: new Date() } });

      // Completing an appointment closes two loops, neither on the critical path:
      // (1) award the practitioner efficiency / low-waste points, and
      // (2) ask the client for a review (if enabled in settings).
      try {
        const { awardForCompletedAppointment } = await import('@/lib/gamification');
        await awardForCompletedAppointment(bookingId);
      } catch (e) {
        console.error('[bookings] gamification on complete failed:', (e as Error)?.message);
      }
      // (3) credit the client their loyalty points (idempotent; also fires when
      // the booking is later charged, whichever happens first).
      try {
        const { awardClientSpend } = await import('@/lib/client-loyalty');
        await awardClientSpend(bookingId);
      } catch (e) {
        console.error('[bookings] loyalty on complete failed:', (e as Error)?.message);
      }
      try {
        const { getSetting } = await import('@/lib/settings');
        if (await getSetting('review_requests_enabled')) {
          const { ensureReviewRequest, sendReviewRequest } = await import('@/lib/review-system');
          const review = await ensureReviewRequest(bookingId);
          // Send once only: `channel` is null until the first request goes out.
          if (review && review.status === 'PENDING' && !review.channel) {
            await sendReviewRequest(review.id, 'EMAIL');
          }
        }
      } catch (e) {
        console.error('[bookings] review request on complete failed:', (e as Error)?.message);
      }
      // NPS satisfaction survey (opt-in), at most once per client / ~90 days.
      try {
        const { getSetting } = await import('@/lib/settings');
        if (await getSetting('nps_survey')) {
          const { npsSentRecently, sendNps } = await import('@/lib/nps');
          const client = await db.client.findUnique({ where: { id: b.clientId }, select: { email: true, firstName: true, unsubscribed: true } });
          if (client?.email && !client.unsubscribed && !(await npsSentRecently(b.clientId, 90))) {
            await sendNps({ clientId: b.clientId, email: client.email, firstName: client.firstName, bookingId: b.id, treatment: b.treatmentTitle });
          }
        }
      } catch (e) {
        console.error('[bookings] NPS on complete failed:', (e as Error)?.message);
      }
      // Post-course check-in (opt-in): once a client completes a full course of a
      // course-based treatment, congratulate + suggest maintenance. Once per course.
      try {
        const { getSetting } = await import('@/lib/settings');
        if (await getSetting('post_course_checkin')) {
          const { courseLength, recommendedNext, formatInterval } = await import('@/lib/treatment-intervals');
          const len = courseLength(b.treatmentSlug);
          if (len) {
            const completed = await db.booking.count({ where: { clientId: b.clientId, treatmentSlug: b.treatmentSlug, status: 'COMPLETED' } });
            if (completed >= len) {
              const dup = await db.emailEvent.findFirst({ where: { clientId: b.clientId, kind: 'FOLLOW_UP', status: 'SENT', meta: { path: ['postCourseSlug'], equals: b.treatmentSlug } } });
              if (!dup) {
                const client = await db.client.findUnique({ where: { id: b.clientId }, select: { email: true, firstName: true, unsubscribed: true } });
                if (client?.email && !client.unsubscribed) {
                  const rec = recommendedNext(b.treatmentSlug, completed);
                  const base = (process.env.NEXT_PUBLIC_SITE_URL || site.url).replace(/\/$/, '');
                  const { sendEmail, tmplPostCourse } = await import('@/lib/email');
                  const res = await sendEmail({ to: client.email, subject: `Your ${b.treatmentTitle} course is complete`, html: tmplPostCourse({ firstName: client.firstName, treatment: b.treatmentTitle, rebookUrl: `${base}/book?treatment=${encodeURIComponent(b.treatmentSlug)}`, maintenance: rec ? formatInterval(rec.weeks) : null }) });
                  await db.emailEvent.create({ data: { clientId: b.clientId, kind: 'FOLLOW_UP', to: client.email, subject: `Course complete — ${b.treatmentTitle}`, status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error, meta: { postCourseSlug: b.treatmentSlug } } }).catch(() => {});
                }
              }
            }
          }
        }
      } catch (e) {
        console.error('[bookings] post-course check-in failed:', (e as Error)?.message);
      }
    }
  }
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath('/admin/bookings');
  return { ok: true };
}

// Staff cancel with optional fee waiver (override of the within-24h charge).
export async function cancelBookingAction(bookingId: string, opts: { reason?: string; waiveFee?: boolean }) {
  if (!crmEnabled) return { ok: false, error: 'CRM disabled' };
  const session = await getSession();
  if (!session) return { ok: false, error: 'Unauthorised' };
  if (!sessionCan(session, 'bookings.manage')) return { ok: false, error: 'You don’t have permission to manage bookings.' };
  const { cancelBooking } = await import('@/lib/booking-actions');
  const res = await cancelBooking(bookingId, { by: session.email, reason: opts.reason, waiveFee: opts.waiveFee });
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath('/admin/bookings');
  return res;
}

// BLD-211 — reassign the practitioner/specialist on a booking. Admins/managers
// only; the new clinician must be bookable and competent for the treatment.
export async function reassignPractitioner(bookingId: string, practitionerId: string | null): Promise<{ ok: boolean; error?: string }> {
  if (!crmEnabled) return { ok: false, error: 'CRM disabled' };
  const session = await getSession();
  if (!session || !sessionCan(session, 'bookings.manage')) return { ok: false, error: 'You don’t have permission to reassign appointments.' };
  const { db } = await import('@/lib/db');
  const booking = await db.booking.findUnique({ where: { id: bookingId }, select: { treatmentSlug: true } });
  if (!booking) return { ok: false, error: 'Booking not found.' };

  let label = 'unassigned';
  if (practitionerId) {
    const clin = await db.adminUser.findFirst({ where: { id: practitionerId, active: true, isClinician: true }, select: { name: true, email: true, competencies: true } });
    if (!clin) return { ok: false, error: 'That person isn’t a bookable clinician.' };
    // A clinician with explicit competencies must list this treatment; an empty
    // list means a generalist (no restriction).
    if (clin.competencies.length && !clin.competencies.includes(booking.treatmentSlug)) {
      return { ok: false, error: 'That clinician isn’t set up to perform this treatment.' };
    }
    label = clin.name || clin.email;
  }

  await db.booking.update({ where: { id: bookingId }, data: { practitionerId: practitionerId || null } });
  try {
    const { logAudit } = await import('@/lib/audit');
    await logAudit({ action: 'PRACTITIONER_ASSIGNED', actor: session.email, actorRole: session.role, bookingId, summary: `Practitioner ${practitionerId ? `changed to ${label}` : 'unassigned'}` });
  } catch { /* non-fatal */ }
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath('/admin/bookings');
  return { ok: true };
}

// BLD-105 — staff reschedule an appointment (change date/time) without
// cancel-and-rebook. Reuses rescheduleBooking with the admin override (no 48h
// notice / window / fee rules), but keeps the slot-availability + future-time
// guards, the client confirmation email, calendar re-push and audit.
export async function rescheduleBookingAction(bookingId: string, newStartISO: string): Promise<{ ok: boolean; error?: string }> {
  if (!crmEnabled) return { ok: false, error: 'CRM disabled' };
  const session = await getSession();
  if (!session || !sessionCan(session, 'bookings.manage')) return { ok: false, error: 'You don’t have permission to reschedule appointments.' };
  if (!newStartISO) return { ok: false, error: 'Pick a new date and time.' };
  const { rescheduleBooking } = await import('@/lib/booking-actions');
  const r = await rescheduleBooking(bookingId, newStartISO, { by: session.email, admin: true });
  return r.ok ? { ok: true } : { ok: false, error: r.error || 'Could not reschedule.' };
}
