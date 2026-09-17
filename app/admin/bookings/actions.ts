'use server';

import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionIsAdmin } from '@/lib/auth';
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
  // BLD-1119: a BNPL/Klarna/Clearpay course pre-payment sets prepaidAt, not
  // chargedAt, and never touches the card on file — treat it the same as an
  // existing charge so staff can't bill that card a second time.
  if (booking.chargedAt) return { ok: false, error: 'Already charged' };
  if (booking.prepaidAt) return { ok: false, error: 'This course was pre-paid in full (Klarna/Clearpay) — there is nothing left to charge.' };
  // BLD-882: net an applied gift voucher SERVER-SIDE, here in the one shared
  // charge action, so every surface (session checkout, booking detail page, a
  // reloaded till) collects only the remainder — no UI has to know about the
  // voucher for the arithmetic to hold.
  // BLD-1001: also net off redeemed loyalty points SERVER-SIDE, same as the
  // voucher above — the client-side prefill in BookingActions.tsx is not a
  // substitute (a stale UI, an edited amount, or a replayed request would
  // otherwise charge the card the full pre-discount price, double-charging a
  // client who already redeemed points as money off this booking).
  const voucherOffPence = booking.giftVoucherPence ?? 0;
  const pointsOffPence = booking.pointsRedeemedPence ?? 0;
  amountPence = Math.round(amountPence) - voucherOffPence - pointsOffPence;
  if (amountPence <= 0) return { ok: false, error: 'The applied gift voucher and/or redeemed loyalty points already cover this amount — remove them first to adjust the price.' };
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
    const vnoteParts = [
      voucherOffPence > 0 ? `gift voucher £${(voucherOffPence / 100).toFixed(2)}` : null,
      pointsOffPence > 0 ? `loyalty points £${(pointsOffPence / 100).toFixed(2)}` : null,
    ].filter(Boolean).join(' + ');
    const vnote = vnoteParts ? ` + ${vnoteParts} already applied` : '';
    await db.interaction.create({ data: { clientId: booking.clientId, type: 'APPOINTMENT', summary: `Charged £${(amountPence / 100).toFixed(2)} for ${booking.treatmentTitle}${disc}${vnote}`, author: session.email } });
    await logAudit({ action: 'PAYMENT_CHARGED', actor: session.email, actorRole: session.role, bookingId, clientId: booking.clientId, summary: `Charged £${(amountPence / 100).toFixed(2)}${disc}${vnote}` });
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
      await sendPurchase({ bookingId, valuePence: amountPence, clientId: booking.clientId, email: booking.client?.marketingOptIn ? (booking.client?.email ?? null) : null, campaign: booking.attribCampaign, gclid: booking.gclid, analyticsConsent: booking.analyticsConsent, marketingConsent: booking.marketingConsent });
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
  const b = await db.booking.findUnique({ where: { id: bookingId }, select: { status: true, clientId: true, startAt: true, endAt: true, durationMin: true, bufferMin: true, treatmentSlug: true, locationId: true, practitionerId: true, resources: { select: { id: true } } } });
  if (!b) return { ok: false, error: 'Booking not found.' };
  if (b.status !== 'REQUESTED') return { ok: false, error: 'This request has already been actioned.' };
  const { isSlotFree } = await import('@/lib/availability');
  // Staff are confirming same-day, so no online lead window applies — but the room
  // and clinician must still be genuinely free right now.
  const free = await isSlotFree(b.startAt.toISOString(), b.durationMin, b.treatmentSlug, b.locationId, { leadMinutes: 0 });
  if (!free) return { ok: false, error: 'That time is no longer free. Reschedule with the client, or decline the request.', clash: true };
  // Atomically re-check for a clash immediately before confirming — isSlotFree
  // doesn't take a tx client, so two staff approving the same slot could both
  // pass the check above and both confirm (PRJ-1043.8). Mirrors
  // app/api/booking/create: a Serializable transaction re-reads overlapping
  // bookings on THIS booking's own clinician/room(s) right before the write.
  const resourceIds = b.resources.map((r) => r.id);
  const endBuffered = new Date(b.endAt.getTime() + b.bufferMin * 60_000);
  let confirmed: { id: string } | null = null;
  try {
    confirmed = await db.$transaction(async (tx) => {
      const overlapping = await tx.booking.findMany({
        where: { id: { not: bookingId }, status: { in: ['PENDING', 'CONFIRMED'] }, startAt: { lt: endBuffered }, endAt: { gt: b.startAt } },
        select: { practitionerId: true, resources: { select: { id: true } } },
      });
      const practitionerClash = !!b.practitionerId && overlapping.some((o) => o.practitionerId === b.practitionerId);
      const resourceClash = resourceIds.length > 0 && overlapping.some((o) => o.resources.some((r) => resourceIds.includes(r.id)));
      if (practitionerClash || resourceClash) return null;
      return tx.booking.update({ where: { id: bookingId }, data: { status: 'CONFIRMED' }, select: { id: true } });
    }, { isolationLevel: 'Serializable' });
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === 'P2034' || /write conflict|deadlock|could not serialize/i.test(err.message || '')) {
      return { ok: false, error: 'That time is no longer free. Reschedule with the client, or decline the request.', clash: true };
    }
    throw e;
  }
  if (!confirmed) {
    return { ok: false, error: 'That time is no longer free. Reschedule with the client, or decline the request.', clash: true };
  }
  await db.interaction.create({ data: { clientId: b.clientId, type: 'APPOINTMENT', summary: 'Same-day request approved', author: session.email } });
  try { const { notifyBookingConfirmed } = await import('@/lib/booking-notify'); await notifyBookingConfirmed(bookingId); } catch { /* best-effort */ }
  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'BOOKING_CONFIRMED', actor: session.email, actorRole: session.role, clientId: b.clientId, bookingId, summary: 'Same-day request approved' });
  revalidatePath(`/admin/bookings/${bookingId}`); revalidatePath('/admin/bookings');
  return { ok: true };
}

// BLD-1347: `opts.waiveFee` is the override on the no-show branch. Without it a
// no-show now applies the published 24-hour policy — the full fee is taken, as a
// card charge or as one session off a prepaid package (see noShowFee below).
export async function setBookingStatus(
  bookingId: string,
  status: 'COMPLETED' | 'NO_SHOW' | 'CONFIRMED',
  opts: { waiveFee?: boolean } = {},
): Promise<{ ok: boolean; error?: string; charged?: number; sessionConsumed?: boolean; feeFailed?: boolean; requiresAction?: boolean }> {
  if (!crmEnabled) return { ok: false, error: 'CRM disabled' };
  const session = await getSession();
  if (!session || !sessionCan(session, 'bookings.manage')) return { ok: false, error: 'You don’t have permission to update appointments.' };
  // Taking money needs the payment permission; waiving a fee that is owed is a
  // financial concession, so it needs it too. Marking the no-show itself doesn't.
  if (status === 'NO_SHOW' && opts.waiveFee && !sessionCan(session, 'bookings.charge')) {
    return { ok: false, error: 'You don’t have permission to waive a no-show fee.' };
  }
  const { db } = await import('@/lib/db');
  // BLD-1249: the live checkout screen (SessionRunner) gates every payment
  // method — including "Record cash" — on booking.finishedAt, not on status.
  // That field is normally stamped by the live session's "End treatment" step
  // (clinical-actions.ts finishAppointment). This "Mark completed" shortcut
  // only ever set status, so a booking completed from here stayed COMPLETED
  // with finishedAt permanently null — the payment buttons on checkout then
  // stayed disabled forever with no way to unstick them. Stamp finishedAt
  // here too, and clear it on "Reset to confirmed" so the two stay in sync.
  const prior = status === 'COMPLETED' || status === 'CONFIRMED'
    ? await db.booking.findUnique({ where: { id: bookingId }, select: { startedAt: true, finishedAt: true } })
    : null;
  const data: { status: typeof status; finishedAt?: Date | null; actualMinutes?: number | null; packageSessionUsedAt?: Date | null; packageSessionUsedBy?: string | null } = { status };
  // BLD-1347: "Reset to confirmed" undoes a mis-clicked no-show, so it must also
  // hand back the prepaid session that no-show spent. The derived balance already
  // stops counting it (isUsed needs a CANCELLED/NO_SHOW status), but leaving the
  // mark behind would make the booking-detail badge claim a session was used on a
  // live appointment.
  if (status === 'CONFIRMED') { data.packageSessionUsedAt = null; data.packageSessionUsedBy = null; }
  if (status === 'COMPLETED' && prior && !prior.finishedAt) {
    const finishedAt = new Date();
    data.finishedAt = finishedAt;
    data.actualMinutes = prior.startedAt ? Math.max(1, Math.round((finishedAt.getTime() - prior.startedAt.getTime()) / 60000)) : null;
  } else if (status === 'CONFIRMED' && prior?.finishedAt) {
    data.finishedAt = null;
    data.actualMinutes = null;
  }
  await db.booking.update({ where: { id: bookingId }, data });
  let fee: { charged: number; sessionConsumed: boolean; waived: boolean; alreadyPaid: boolean; requiresAction: boolean; feeFailed: boolean } | null = null;
  const b = await db.booking.findUnique({ where: { id: bookingId } });
  if (b) {
    await db.interaction.create({ data: { clientId: b.clientId, type: 'APPOINTMENT', summary: `Booking marked ${status.toLowerCase().replace('_', ' ')}`, author: session.email } });
    if (status === 'NO_SHOW') {
      // Let the diary know a client didn't show (the staff member who marked it is skipped).
      try {
        const { notifyStaffByPermission } = await import('@/lib/notifications');
        await notifyStaffByPermission('bookings.manage', { kind: 'status', category: 'bookings', priority: 'normal', title: `No-show: ${b.treatmentTitle}`, body: b.startAt.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }), href: `/admin/bookings/${b.id}` }, session.email);
      } catch { /* non-fatal */ }
      // PRJ-1118.12: release a reserved-but-unconsumed gift-voucher application,
      // mirroring cancelBooking's BLD-882 guard — a booking already charged before
      // the no-show consumed its voucher as part of that settled sale; only an
      // unconsumed reservation (never charged) returns automatically.
      if ((b.giftVoucherPence ?? 0) > 0 && b.giftVoucherCode && !b.chargedAt) {
        try {
          const cleared = await db.booking.updateMany({
            // `chargedAt: null` is in the guard here (cancelBooking deliberately
            // omits it, because a late fee charged DURING that cancellation sets
            // chargedAt and must not block the return). Nothing charges on the
            // no-show path, so any chargedAt landing between the read above and
            // this write is a concurrent till charge that already netted the
            // voucher off — matching zero rows is the correct outcome.
            where: { id: b.id, giftVoucherCode: b.giftVoucherCode, giftVoucherPence: b.giftVoucherPence, chargedAt: null },
            data: { giftVoucherCode: null, giftVoucherPence: 0 },
          });
          if (cleared.count > 0) {
            const { creditVoucher } = await import('@/lib/gift-vouchers');
            await creditVoucher(b.giftVoucherCode, b.giftVoucherPence);
            const { logAudit } = await import('@/lib/audit');
            await logAudit({ action: 'REWARD_REDEEMED', actor: session.email, actorRole: session.role, bookingId: b.id, clientId: b.clientId, summary: `Gift voucher ${b.giftVoucherCode} returned on no-show — £${(b.giftVoucherPence / 100).toFixed(2)} back on the voucher` }).catch(() => {});
          }
        } catch (e) {
          console.error('[setBookingStatus] voucher re-credit failed (continuing):', (e as Error)?.message);
        }
      }

      // BLD-1347: apply the published no-show fee — a card charge, or one
      // session off a prepaid package, or nothing when staff waived it. Runs
      // LAST in this branch, after the voucher release above, so that release
      // still sees the pre-fee chargedAt the BLD-882 guard depends on. Never
      // throws: a payment problem must not stop the appointment being marked.
      try {
        const { applyNoShowFee } = await import('@/lib/booking-actions');
        fee = await applyNoShowFee(bookingId, { by: session.email, waiveFee: opts.waiveFee });
      } catch (e) {
        console.error('[setBookingStatus] no-show fee failed (continuing):', (e as Error)?.message);
      }

      // Warm rebooking note (opt-in). Care-class, deduped once per booking.
      // BLD-1482: sent AFTER applyNoShowFee above (not before) and using its
      // returned `charged` amount, not the pre-fee b.chargedPence read at the
      // top of this function -- otherwise the email always reported the fee as
      // unpaid, even when applyNoShowFee had just charged it moments earlier.
      // `charged` is 0 on every branch that took no card fee (waived, package
      // session consumed, alreadyPaid, 3DS requiresAction, declined), so the
      // template's fee paragraph is correctly omitted for all of them. If
      // applyNoShowFee itself threw, `fee` is null and we send no fee amount at
      // all: b.chargedPence is the booking's total settled charge, NOT a no-show
      // fee, so falling back to it would tell an already-paid client that "a fee
      // of £X was applied to your card" when nothing was taken.
      try {
        const { getSetting } = await import('@/lib/settings');
        if (await getSetting('no_show_notice')) {
          const client = await db.client.findUnique({ where: { id: b.clientId }, select: { email: true, firstName: true, unsubscribed: true } });
          const already = await db.emailEvent.findFirst({ where: { kind: 'NO_SHOW', status: 'SENT', meta: { path: ['bookingId'], equals: b.id } } });
          if (client?.email && !client.unsubscribed && !already) {
            const base = (process.env.NEXT_PUBLIC_SITE_URL || site.url).replace(/\/$/, '');
            const { sendEmail, tmplNoShow } = await import('@/lib/email');
            const res = await sendEmail({ to: client.email, subject: `Sorry we missed you — rebook your ${b.treatmentTitle}`, html: tmplNoShow({ firstName: client.firstName, treatment: b.treatmentTitle, start: b.startAt, rebookUrl: `${base}/book?treatment=${encodeURIComponent(b.treatmentSlug)}`, feePence: fee?.charged ?? null }) });
            await db.emailEvent.create({ data: { clientId: b.clientId, kind: 'NO_SHOW', to: client.email, subject: `No-show rebooking — ${b.treatmentTitle}`, status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error, meta: { bookingId: b.id } } }).catch(() => {});
          }
        }
      } catch (e) {
        console.error('[bookings] no-show notice failed:', (e as Error)?.message);
      }
    }
    if (status === 'COMPLETED') {
      await db.client.update({ where: { id: b.clientId }, data: { lastVisitAt: new Date() } });

      // (0) Release any manually-flagged "occupied" room (BLD-506) — the client
      // has left. finishAppointment() does this on the live-session path, and
      // since BLD-1249 stamps finishedAt here it now returns early when called
      // afterwards, so this path has to release the room itself or the in-room
      // screen stays Occupied until someone taps Vacant.
      try {
        const { clearOccupiedForBooking } = await import('@/lib/room-prep');
        await clearOccupiedForBooking(bookingId);
      } catch (e) {
        console.error('[bookings] clear room occupancy on complete failed:', (e as Error)?.message);
      }

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
  // BLD-1347: the client's package balance and outstanding-fee warning both
  // render off this booking, so refresh their record too.
  if (b && fee && (fee.sessionConsumed || fee.charged > 0 || fee.waived)) revalidatePath(`/admin/clients/${b.clientId}`);
  return {
    ok: true,
    ...(fee ? { charged: fee.charged, sessionConsumed: fee.sessionConsumed, feeFailed: fee.feeFailed, requiresAction: fee.requiresAction } : {}),
  };
}

// Staff cancel with optional fee waiver (override of the within-24h charge).
export async function cancelBookingAction(bookingId: string, opts: { reason?: string; waiveFee?: boolean }) {
  if (!crmEnabled) return { ok: false, error: 'CRM disabled' };
  const session = await getSession();
  if (!session) return { ok: false, error: 'Unauthorised' };
  if (!sessionCan(session, 'bookings.manage')) return { ok: false, error: 'You don’t have permission to manage bookings.' };
  // BLD-1437: waiving the cancellation fee is a financial concession, same as
  // waiving a no-show fee above — it needs bookings.charge, not just bookings.manage.
  if (opts.waiveFee && !sessionCan(session, 'bookings.charge')) {
    // Exception: declining a same-day REQUEST. That booking was never
    // confirmed, holds no slot and has no card on file, so there is no fee to
    // concede — and SameDayRequestActions must pass waiveFee, because a
    // same-day request is by definition inside 24h and cancelling it without
    // the waiver would bill the client in full for an appointment the clinic
    // itself refused. Read the status server-side; the caller's flag alone is
    // not trusted for this.
    const { db } = await import('@/lib/db');
    const b = await db.booking.findUnique({ where: { id: bookingId }, select: { status: true } });
    if (b?.status !== 'REQUESTED') {
      return { ok: false, error: 'You don’t have permission to waive fees.' };
    }
  }
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
    // BLD-1474: 'consultation' is a reserved pseudo-treatment slug (see
    // create-action.ts) deliberately kept out of the real treatment catalogue,
    // so it can never appear in anyone's competencies — the Schedules picker
    // only offers checkboxes built from bookableTreatments. Applied here, the
    // rule rejected EVERY clinician who has any specialism set, so the eligible
    // list on the booking-detail page (fixed in the same ticket) could be saved
    // by nobody. Any active clinician can run a consultation.
    if (booking.treatmentSlug !== 'consultation' && clin.competencies.length && !clin.competencies.includes(booking.treatmentSlug)) {
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

// BLD-1096 — owner request: sometimes a client cancels with enough notice that
// no late fee applies, but the clinic and client have separately agreed the
// prepaid package session is spent rather than credited back. This marks that
// WITHOUT touching the booking's status — it stays CANCELLED in the diary and
// the client's appointment history — and deducts one session from the client's
// package balance by making lib/package-sessions.ts's derived totals count it as
// used (same mechanism as a COMPLETED session; nothing is reimplemented here).
// Admin/owner only, same gate as the paid-price correction (BLD-1094).
export async function markPackageSessionUsed(bookingId: string): Promise<{ ok: boolean; error?: string }> {
  if (!crmEnabled) return { ok: false, error: 'CRM disabled' };
  const session = await getSession();
  if (!session || !sessionIsAdmin(session)) return { ok: false, error: 'Only an admin can mark a cancelled appointment as a used package session.' };
  const { db } = await import('@/lib/db');
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { status: true, clientId: true, treatmentTitle: true, packageBookingId: true, packageSessionUsedAt: true },
  });
  if (!booking) return { ok: false, error: 'Booking not found.' };
  // BLD-1347: a no-show now consumes the session automatically, but staff still
  // need the manual mark on both statuses — to re-apply it after an
  // unmark/undo, and for a cancellation the policy left untouched.
  if (booking.status !== 'CANCELLED' && booking.status !== 'NO_SHOW') return { ok: false, error: 'Only a cancelled or missed appointment can be marked this way.' };
  if (booking.packageSessionUsedAt) return { ok: true }; // idempotent
  // Review fix (BLD-1096): only a FOLLOW-UP session (one linked back to a
  // purchase via packageBookingId) can be marked. The course purchase booking
  // itself must not be: clientPackages() drops a package whose purchase booking
  // is CANCELLED (`status: { notIn: ['CANCELLED','NO_SHOW'] }`) and counts the
  // purchase's own slot without reading packageSessionUsedAt, so marking it
  // would change nothing while the badge and audit entry claimed a session had
  // been deducted.
  if (!booking.packageBookingId) {
    return { ok: false, error: 'This appointment isn’t a session booked against a client package, so there’s no package balance to deduct from. (A cancelled course purchase itself can’t be marked — cancelling it already ends the package.)' };
  }

  await db.booking.update({ where: { id: bookingId }, data: { packageSessionUsedAt: new Date(), packageSessionUsedBy: session.email } });
  const { logAudit } = await import('@/lib/audit');
  await logAudit({
    action: 'SESSION_EDITED', actor: session.email, actorRole: session.role, bookingId, clientId: booking.clientId,
    summary: `Cancelled appointment (${booking.treatmentTitle}) marked "package session used" — one session deducted from the client's package balance; appointment stays Cancelled`,
  });
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath('/admin/bookings');
  revalidatePath(`/admin/clients/${booking.clientId}`);
  return { ok: true };
}

// BLD-1375 — retro-link an existing appointment to a client's prepaid course
// (owner request: "link all appointments to her 6-session package"). Sessions
// booked THROUGH the package flows link automatically; appointments booked
// separately (by phone, or before the course was set up) never get the link, so
// the package balance over-counts what's left. This attaches such an
// appointment to the purchase after the fact. Validation mirrors the client
// booking flow (app/api/booking/start): same client, same treatment, and — when
// the appointment will occupy a slot — a session genuinely left, re-counted
// inside a Serializable transaction against the same occupancy definition the
// derived balance uses.

// BLD-1824 review: what linking took off an appointment, recorded on the link's
// own audit entry so unlinking can put exactly that back. (No schema change —
// the deploy gate only takes additive columns, and AuditEvent.meta already
// exists for precisely this kind of before/after record.)
type PackageZeroing = { itemId: string; itemPricePence: number; itemDiscountPence: number; removedPence: number };
// "Linked, but nothing was zeroed" — an empty itemId. Distinct from the null the
// transaction returns for "the course is full", which is an error the caller
// reports rather than a successful link.
const NO_ZEROING = { itemId: '', itemPricePence: 0, itemDiscountPence: 0, removedPence: 0 } satisfies PackageZeroing;

/** The pre-link amounts recorded on the most recent link of this booking to this
 *  course, or null if there is no usable record (an older link, or a link that
 *  zeroed nothing). Never throws. */
async function priorPackageZeroing(bookingId: string, purchaseBookingId: string): Promise<PackageZeroing | null> {
  const { db } = await import('@/lib/db');
  const rows = await db.auditEvent.findMany({
    where: { bookingId, action: 'SESSION_EDITED' },
    orderBy: { createdAt: 'desc' },
    take: 25,
    select: { meta: true },
  }).catch(() => [] as { meta: unknown }[]);
  for (const r of rows) {
    const m = r.meta as unknown as Record<string, unknown> | null;
    if (!m || m.packageBookingId !== purchaseBookingId) continue;
    const z = m.packagePriceZeroed as Partial<PackageZeroing> | undefined | null;
    if (!z) continue;
    if (typeof z.itemId === 'string' && z.itemId && typeof z.itemPricePence === 'number'
      && typeof z.itemDiscountPence === 'number' && typeof z.removedPence === 'number') {
      return { itemId: z.itemId, itemPricePence: z.itemPricePence, itemDiscountPence: z.itemDiscountPence, removedPence: z.removedPence };
    }
  }
  return null;
}

export async function linkBookingToPackage(bookingId: string, purchaseBookingId: string): Promise<{ ok: boolean; error?: string }> {
  if (!crmEnabled) return { ok: false, error: 'CRM disabled' };
  const session = await getSession();
  if (!session || !sessionCan(session, 'bookings.manage')) return { ok: false, error: 'You don’t have permission to manage bookings.' };
  if (!purchaseBookingId || bookingId === purchaseBookingId) return { ok: false, error: 'Pick the course purchase to link this appointment to.' };
  const { db } = await import('@/lib/db');
  const b = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      clientId: true, status: true, treatmentSlug: true, treatmentTitle: true, packageBookingId: true, chargedAt: true,
      prepaidAt: true, giftVoucherPence: true, pointsRedeemed: true,
      items: { where: { isAddon: false }, orderBy: { createdAt: 'asc' }, take: 1, select: { sessions: true } },
    },
  });
  if (!b) return { ok: false, error: 'Booking not found.' };
  if (b.packageBookingId) return { ok: false, error: 'This appointment is already linked to a package. Unlink it first if it belongs to a different course.' };
  if ((b.items[0]?.sessions ?? 1) > 1) return { ok: false, error: 'This appointment IS a course purchase — it can’t also be a session of another package.' };
  // An appointment paid on its own card charge isn't a package session — linking
  // it would spend a prepaid session AND keep the money, double-charging the
  // client. Refund the standalone charge first if it should come off the course.
  if (b.chargedAt) return { ok: false, error: 'This appointment was charged separately, so it can’t also use a prepaid package session. Refund that charge first if it should come off the course.' };
  // BLD-1824 review: chargedAt alone is not "has this been paid". A BNPL
  // settlement records the money on prepaidAt/prepaidPence and never touches
  // chargedAt — the same trap BLD-1119/BLD-1200 fixed in the session route and
  // outstandingBalance. Linking here now zeroes the price, so an unguarded
  // prepaidAt would hand back a paid-for visit AND spend a prepaid session.
  if (b.prepaidAt) return { ok: false, error: 'This appointment was pre-paid in full, so it can’t also use a prepaid package session. Refund that payment first if it should come off the course.' };
  // A gift voucher applied to this appointment has already been debited off the
  // voucher (lib/gift-vouchers reserveVoucher). Zeroing the price below would
  // leave that balance spent against a £0 visit with nothing to return it.
  if ((b.giftVoucherPence ?? 0) > 0) {
    return { ok: false, error: 'A gift voucher is applied to this appointment. Remove it first (Remove voucher on the appointment’s payment panel puts the balance back on the card), then link it to the course.' };
  }

  const { clientPackages, packageOccupancyWhere } = await import('@/lib/package-sessions');
  const pkg = (await clientPackages(b.clientId)).find((p) => p.purchaseBookingId === purchaseBookingId);
  if (!pkg) return { ok: false, error: 'That course isn’t on this client’s account.' };
  if (pkg.treatmentSlug !== b.treatmentSlug) return { ok: false, error: `That course is for a different treatment (${pkg.label}).` };

  // A live or completed appointment occupies a slot the moment it's linked
  // (that's the point, for retro-linking taken sessions); a cancelled/missed
  // one only counts if staff later mark it used, so no balance is needed yet.
  const occupies = !['CANCELLED', 'NO_SHOW'].includes(b.status);
  let zeroed: PackageZeroing | null = null;
  try {
    const linked = await db.$transaction(async (tx) => {
      if (occupies) {
        const total = (await tx.bookingItem.findFirst({ where: { bookingId: purchaseBookingId, isAddon: false }, orderBy: { createdAt: 'asc' }, select: { sessions: true } }))?.sessions ?? 1;
        const occupied = await tx.booking.count({ where: packageOccupancyWhere(purchaseBookingId) });
        if (occupied >= total) return null;
      }
      // BLD-1824: a package session is covered by the purchase — it must not
      // also charge (or show as owing) its own individual treatment price. Zero
      // the primary line item's price/discount and net that out of the booking
      // total, mirroring how a package session is priced when booked THROUGH
      // the package flow in the first place (base = 0 — BLD-1346, booking/start
      // and create-action). Any add-on booked in the same slot is untouched —
      // the package covers the primary treatment only.
      //
      // Review fix: only for an appointment that actually takes a session
      // (`occupies`). On a CANCELLED-late or NO_SHOW booking pricePence is not a
      // price — it IS the unwaived late-cancel/no-show fee the client owes, which
      // lib/outstanding.ts derives from `pricePence > 0`. Zeroing it there would
      // write that debt off silently while leaving the session unspent: the link
      // alone consumes nothing, staff still have to mark the session used, which
      // is how BLD-1347 takes the fee out of the course instead.
      const current = occupies ? await tx.booking.findUnique({ where: { id: bookingId }, select: { pricePence: true } }) : null;
      const primaryItem = occupies
        ? await tx.bookingItem.findFirst({ where: { bookingId, isAddon: false }, orderBy: { createdAt: 'asc' }, select: { id: true, pricePence: true, discountPence: true } })
        : null;
      if (current && primaryItem) {
        const netPrimary = Math.max(0, primaryItem.pricePence - primaryItem.discountPence);
        // Never below zero, and never take off more than the booking total holds
        // (add-ons keep their own share of it).
        const removedPence = Math.min(netPrimary, current.pricePence);
        await tx.booking.update({ where: { id: bookingId }, data: { packageBookingId: purchaseBookingId, pricePence: current.pricePence - removedPence } });
        await tx.bookingItem.update({ where: { id: primaryItem.id }, data: { pricePence: 0, discountPence: 0 } });
        return { itemId: primaryItem.id, itemPricePence: primaryItem.pricePence, itemDiscountPence: primaryItem.discountPence, removedPence };
      }
      await tx.booking.update({ where: { id: bookingId }, data: { packageBookingId: purchaseBookingId } });
      return NO_ZEROING;
    }, { isolationLevel: 'Serializable' });
    if (!linked) return { ok: false, error: 'That course has no sessions left — every session is already taken or booked.' };
    zeroed = linked.itemId ? linked : null;
  } catch {
    return { ok: false, error: 'Could not link just now (another update was in flight). Please try again.' };
  }

  // Review fix: the treatment now costs nothing, so loyalty points the client
  // spent on it go back to their balance — the same rule the cancellation and
  // refund paths follow (lib/booking-actions.ts). Left burnt, the client would
  // have paid points for a visit the course already covers.
  let pointsReturned = 0;
  if (zeroed && b.pointsRedeemed > 0) {
    try {
      const { refundBookingPoints } = await import('@/lib/client-loyalty');
      await refundBookingPoints(bookingId);
      pointsReturned = b.pointsRedeemed;
    } catch (e) {
      console.error('[linkBookingToPackage] loyalty points return failed (continuing):', (e as Error)?.message);
    }
  }

  const { logAudit } = await import('@/lib/audit');
  await logAudit({
    action: 'SESSION_EDITED', actor: session.email, actorRole: session.role, bookingId, clientId: b.clientId,
    summary: `Appointment (${b.treatmentTitle}, ${b.status.toLowerCase().replace('_', ' ')}) linked to package ${pkg.label} — now counts against the course balance`
      + (zeroed ? `; its own price was zeroed (£${(zeroed.removedPence / 100).toFixed(2)} off this appointment) — the course purchase carries the money` : '')
      + (pointsReturned ? `; ${pointsReturned} loyalty points returned to the client` : ''),
    // packagePriceZeroed is what unlinkBookingFromPackage reads to put the money
    // back, so it has to stay on the entry, not just in the summary text.
    meta: { packageBookingId: purchaseBookingId, ...(zeroed ? { packagePriceZeroed: zeroed } : {}) },
  }).catch(() => {});
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath(`/admin/bookings/${purchaseBookingId}`);
  revalidatePath('/admin/bookings');
  revalidatePath(`/admin/clients/${b.clientId}`);
  return { ok: true };
}

// Undo of the above — detaches the appointment from the package (and clears any
// "session used" mark, which is meaningless without the link). Same gate.
export async function unlinkBookingFromPackage(bookingId: string): Promise<{ ok: boolean; error?: string }> {
  if (!crmEnabled) return { ok: false, error: 'CRM disabled' };
  const session = await getSession();
  if (!session || !sessionCan(session, 'bookings.manage')) return { ok: false, error: 'You don’t have permission to manage bookings.' };
  const { db } = await import('@/lib/db');
  const b = await db.booking.findUnique({ where: { id: bookingId }, select: { clientId: true, treatmentTitle: true, packageBookingId: true } });
  if (!b) return { ok: false, error: 'Booking not found.' };
  if (!b.packageBookingId) return { ok: true }; // idempotent

  // BLD-1824 review fix: linking zeroes the appointment's own price (the course
  // carries the money), so the undo has to put it back — otherwise an
  // appointment linked by mistake stays free for ever, with nothing on screen
  // saying so. The pre-link amounts are on the link's own audit entry.
  const prior = await priorPackageZeroing(bookingId, b.packageBookingId);
  let restoredPence = 0;
  try {
    restoredPence = await db.$transaction(async (tx) => {
      await tx.booking.update({ where: { id: bookingId }, data: { packageBookingId: null, packageSessionUsedAt: null, packageSessionUsedBy: null } });
      if (!prior) return 0;
      const item = await tx.bookingItem.findUnique({ where: { id: prior.itemId }, select: { bookingId: true, pricePence: true, discountPence: true } });
      const bk = await tx.booking.findUnique({ where: { id: bookingId }, select: { pricePence: true, chargedAt: true, prepaidAt: true } });
      // Only restore a zeroing nobody has touched since. If staff have re-priced
      // the appointment (overrideBookingPrice) or it has been paid, what they set
      // is the truth and this must not overwrite it.
      if (!item || !bk || item.bookingId !== bookingId || item.pricePence !== 0 || item.discountPence !== 0 || bk.chargedAt || bk.prepaidAt) return 0;
      await tx.bookingItem.update({ where: { id: prior.itemId }, data: { pricePence: prior.itemPricePence, discountPence: prior.itemDiscountPence } });
      await tx.booking.update({ where: { id: bookingId }, data: { pricePence: bk.pricePence + prior.removedPence } });
      return prior.removedPence;
    });
  } catch {
    return { ok: false, error: 'Could not unlink just now (another update was in flight). Please try again.' };
  }

  const { logAudit } = await import('@/lib/audit');
  await logAudit({
    action: 'SESSION_EDITED', actor: session.email, actorRole: session.role, bookingId, clientId: b.clientId,
    summary: `Appointment (${b.treatmentTitle}) unlinked from its package — no longer counts against the course balance`
      + (restoredPence ? `; its own price of £${(restoredPence / 100).toFixed(2)} was restored` : ''),
    meta: { packageBookingId: b.packageBookingId, ...(restoredPence ? { packagePriceRestoredPence: restoredPence } : {}) },
  }).catch(() => {});
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath(`/admin/bookings/${b.packageBookingId}`);
  revalidatePath('/admin/bookings');
  revalidatePath(`/admin/clients/${b.clientId}`);
  return { ok: true };
}

// BLD-1824 — record how a package/course purchase was actually paid when it
// happened outside the online booking flow (bank transfer, in-clinic terminal,
// cash): chargedAt/prepaidAt only ever get set by Stripe, so a package settled
// any other way stayed "Not yet paid" forever with nothing in the admin able
// to correct it. Gated on bookings.charge — the same permission that gates
// every other "money has moved" action (chargeBookingAction, refunds).
export type ManualPaymentStatus = 'PAID' | 'PARTIALLY_PAID' | 'NOT_PAID';
const MANUAL_PAYMENT_STATUSES: readonly string[] = ['PAID', 'PARTIALLY_PAID', 'NOT_PAID'];

export async function setPackageManualPayment(
  purchaseBookingId: string,
  status: ManualPaymentStatus,
  opts: { method?: string; amountPence?: number } = {},
): Promise<{ ok: boolean; error?: string }> {
  if (!crmEnabled) return { ok: false, error: 'CRM disabled' };
  const session = await getSession();
  if (!session || !sessionCan(session, 'bookings.charge')) return { ok: false, error: 'You don’t have permission to record payments.' };
  // A server action is a public POST endpoint and the ManualPaymentStatus type is
  // erased at runtime, so validate rather than trusting the caller: an arbitrary
  // string here lands in the column every downstream reader compares against
  // 'PAID' / 'PARTIALLY_PAID' (lib/package-sessions.ts, the client-profile badge).
  if (!MANUAL_PAYMENT_STATUSES.includes(status)) return { ok: false, error: 'Pick a payment status.' };
  const method = typeof opts.method === 'string' ? opts.method.trim().slice(0, 60) : '';
  const { db } = await import('@/lib/db');
  const b = await db.booking.findUnique({
    where: { id: purchaseBookingId },
    select: { clientId: true, treatmentTitle: true, items: { where: { isAddon: false }, orderBy: { createdAt: 'asc' }, take: 1, select: { sessions: true } } },
  });
  if (!b) return { ok: false, error: 'Booking not found.' };
  if ((b.items[0]?.sessions ?? 1) <= 1) return { ok: false, error: 'This appointment isn’t a package/course purchase.' };

  const cleared = status === 'NOT_PAID';
  await db.booking.update({
    where: { id: purchaseBookingId },
    data: {
      manualPaymentStatus: status,
      manualPaymentMethod: cleared ? null : (method || null),
      manualPaymentAmountPence: cleared ? null : (opts.amountPence != null && Number.isFinite(opts.amountPence) ? Math.max(0, Math.round(opts.amountPence)) : null),
      manualPaymentAt: cleared ? null : new Date(),
      manualPaymentBy: cleared ? null : session.email,
    },
  });

  const { logAudit } = await import('@/lib/audit');
  const label = status === 'PAID' ? 'paid' : status === 'PARTIALLY_PAID' ? 'partially paid' : 'not paid';
  await logAudit({
    action: 'SESSION_EDITED', actor: session.email, actorRole: session.role, bookingId: purchaseBookingId, clientId: b.clientId,
    summary: `Package payment status for "${b.treatmentTitle}" set to ${label}${!cleared && method ? ` (${method})` : ''}`,
  }).catch(() => {});
  revalidatePath(`/admin/bookings/${purchaseBookingId}`);
  revalidatePath('/admin/bookings');
  revalidatePath(`/admin/clients/${b.clientId}`);
  return { ok: true };
}

// Undo the mark above — restores the session to the client's package balance.
// Same admin-only gate; the booking's CANCELLED status is untouched either way.
export async function unmarkPackageSessionUsed(bookingId: string): Promise<{ ok: boolean; error?: string }> {
  if (!crmEnabled) return { ok: false, error: 'CRM disabled' };
  const session = await getSession();
  if (!session || !sessionIsAdmin(session)) return { ok: false, error: 'Only an admin can undo this.' };
  const { db } = await import('@/lib/db');
  const booking = await db.booking.findUnique({ where: { id: bookingId }, select: { clientId: true, treatmentTitle: true, packageSessionUsedAt: true } });
  if (!booking) return { ok: false, error: 'Booking not found.' };
  if (!booking.packageSessionUsedAt) return { ok: true }; // idempotent

  await db.booking.update({ where: { id: bookingId }, data: { packageSessionUsedAt: null, packageSessionUsedBy: null } });
  const { logAudit } = await import('@/lib/audit');
  await logAudit({
    action: 'SESSION_EDITED', actor: session.email, actorRole: session.role, bookingId, clientId: booking.clientId,
    summary: `Reverted "package session used" mark on cancelled appointment (${booking.treatmentTitle}) — session restored to the client's package balance`,
  });
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath('/admin/bookings');
  revalidatePath(`/admin/clients/${booking.clientId}`);
  return { ok: true };
}
