import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// BLD-138 v2 — realtime appointment-session coordination. The DB row is the
// single source of truth; every device (front desk, host, clinician, checkout)
// reconciles to snapshots over SSE (./stream) with this route as the write
// path. Clinical gates stay in the existing server actions: this route owns
// step timing, staff handoffs (touchpoints), non-clinical answers, the
// checkout charge, the boutique POS hand-off and the next-visit rebook.
// Write ops return only { ok } — authoritative state arrives over the stream.
const ok = (data: Record<string, unknown> = {}) => NextResponse.json({ ok: true, ...data });
const bad = (error = 'Bad request', status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('bookings.manage');
  if (!session) return bad('Not permitted.', 403);

  const body = await req.json().catch(() => ({}));
  const op = String(body.op || '');
  const bookingId = String(body.bookingId || '');
  if (!bookingId) return bad();

  const { db } = await import('@/lib/db');
  const { isSessionStep, normalizeStepKey, normalizeTimings, advanceTimings, closeTimings } = await import('@/lib/appointment-session');
  const { getStaffProfile, touchpointAppend } = await import('@/lib/appointment-session-server');
  type Timings = import('@/lib/appointment-session').StepTimings;
  type Data = import('@/lib/appointment-session').SessionData;
  type Touchpoints = import('@/lib/appointment-session').Touchpoint[];

  const booking = await db.booking.findUnique({ where: { id: bookingId }, select: { id: true, clientId: true, status: true, finishedAt: true } });
  if (!booking) return bad('Booking not found.', 404);

  switch (op) {
    // Create (or resume) the session; the opener becomes the active staff.
    case 'start': {
      const staff = await getStaffProfile(session.email);
      const resume = async () => {
        const existing = await db.appointmentSession.findUnique({ where: { bookingId } });
        if (!existing) return false;
        if (existing.status !== 'COMPLETED') {
          await db.appointmentSession.update({
            where: { bookingId },
            data: touchpointAppend((existing.touchpoints ?? []) as Touchpoints, normalizeStepKey(existing.currentStep), staff),
          });
        }
        return true;
      };
      if (await resume()) return ok();
      try {
        await db.appointmentSession.create({
          data: {
            bookingId, startedBy: session.email,
            steps: advanceTimings({}, 'arrival') as object,
            ...touchpointAppend([], 'arrival', staff),
          },
        });
      } catch (e) {
        // Two devices opened simultaneously — the loser resumes the winner's row.
        if ((e as { code?: string }).code === 'P2002') { await resume(); return ok(); }
        throw e;
      }
      const { logAudit } = await import('@/lib/audit');
      await logAudit({ action: 'NOTE_ADDED', actor: session.email, actorRole: session.role, bookingId, clientId: booking.clientId, summary: 'Live session started (client checked in)' }).catch(() => {});
      return ok();
    }

    // Take over the session on this device (handoff between team members).
    case 'claim': {
      const row = await db.appointmentSession.findUnique({ where: { bookingId } });
      if (!row) return bad('Session not started.', 404);
      const staff = await getStaffProfile(session.email);
      await db.appointmentSession.update({
        where: { bookingId },
        data: touchpointAppend((row.touchpoints ?? []) as Touchpoints, normalizeStepKey(row.currentStep), staff),
      });
      return ok();
    }

    // Record a step transition; the transitioning staff becomes active.
    case 'enter': {
      const step = body.step;
      if (!isSessionStep(step)) return bad('Unknown step.');
      const row = await db.appointmentSession.findUnique({ where: { bookingId } });
      if (!row) return bad('Session not started.', 404);
      if (row.status === 'COMPLETED') return ok();
      const steps = advanceTimings(normalizeTimings((row.steps ?? {}) as Record<string, Timings[keyof Timings]>), step);
      if (body.skippedFrom && isSessionStep(body.skippedFrom)) {
        const t = steps[body.skippedFrom as keyof Timings];
        if (t) steps[body.skippedFrom as keyof Timings] = { ...t, skipped: true };
      }
      const staff = await getStaffProfile(session.email);
      await db.appointmentSession.update({
        where: { bookingId },
        data: { currentStep: step, steps: steps as object, ...touchpointAppend((row.touchpoints ?? []) as Touchpoints, step, staff) },
      });
      return ok();
    }

    // Save a non-clinical captured answer (edits audited, values kept out).
    case 'save': {
      const field = String(body.field || '').slice(0, 60);
      const value = String(body.value ?? '').slice(0, 2000);
      if (!field) return bad('No field.');
      const row = await db.appointmentSession.findUnique({ where: { bookingId } });
      if (!row) return bad('Session not started.', 404);
      const data = { ...((row.data ?? {}) as Data) };
      const prev = data[field];
      data[field] = { value, by: session.email, at: new Date().toISOString() };
      await db.appointmentSession.update({ where: { bookingId }, data: { data: data as object } });
      if (prev && prev.value !== value) {
        const { logAudit } = await import('@/lib/audit');
        await logAudit({
          action: 'SESSION_EDITED', actor: session.email, actorRole: session.role, bookingId, clientId: booking.clientId,
          summary: `Session answer "${field}" edited (previously saved ${new Date(prev.at).toLocaleString('en-GB')} by ${prev.by})`,
        }).catch(() => {});
      }
      return ok();
    }

    // Client confirms the aftercare walkthrough on screen (typed name).
    case 'aftercare': {
      const confirmedBy = String(body.confirmedBy || '').trim().slice(0, 120);
      if (!confirmedBy) return bad('Please type the client name to confirm.');
      const row = await db.appointmentSession.findUnique({ where: { bookingId } });
      if (!row) return bad('Session not started.', 404);
      const data = { ...((row.data ?? {}) as Data) };
      data['aftercare_confirmed_by'] = { value: confirmedBy, by: session.email, at: new Date().toISOString() };
      await db.appointmentSession.update({ where: { bookingId }, data: { data: data as object } });
      await db.booking.updateMany({ where: { id: bookingId, aftercareAckAt: null }, data: { aftercareAckAt: new Date() } });
      const { logAudit } = await import('@/lib/audit');
      await logAudit({
        action: 'NOTE_ADDED', actor: session.email, actorRole: session.role, bookingId, clientId: booking.clientId,
        summary: `Aftercare walked through in session — confirmed on screen by "${confirmedBy}"`,
      }).catch(() => {});
      // BLD-151: send the care-instructions email immediately so in-session
      // clients leave with written aftercare guidance (automations fire 3 days
      // later and can't backfill the moment of departure).
      const { notifyAftercare } = await import('@/lib/booking-notify');
      notifyAftercare(bookingId).catch((e) => console.error('[session] aftercare email failed:', (e as Error)?.message));
      return ok();
    }

    // Checkout: charge the saved card. All the established safety gates
    // (COMPLETED status, consent, amount caps, loyalty, GA4, Xero) live in
    // chargeBookingAction — this is a thin, permission-checked pass-through.
    case 'charge': {
      const amountPence = Math.round(Number(body.amountPence) || 0);
      if (amountPence <= 0) return bad('Enter an amount to charge.');
      const { chargeBookingAction } = await import('@/app/admin/bookings/actions');
      const r = await chargeBookingAction(bookingId, amountPence);
      if (!r.ok) return bad(r.error || 'Charge failed.');
      return ok();
    }

    // Next visit: create the follow-on booking for the same treatment, card
    // already on file. Availability, practitioner/room assignment and the
    // overlap re-check go through the same engine + Serializable transaction
    // as the public flow, and the client gets the standard confirmation.
    case 'rebook': {
      const startISO = String(body.startISO || '');
      const start = new Date(startISO);
      if (!startISO || isNaN(+start) || start <= new Date()) return bad('Pick a future time.');
      const current = await db.booking.findUnique({
        where: { id: bookingId },
        select: {
          clientId: true, treatmentSlug: true, treatmentTitle: true, durationMin: true, bufferMin: true,
          pricePence: true, locationId: true, stripeCustomerId: true, stripePaymentMethodId: true,
          items: { where: { isAddon: false }, select: { pricePence: true }, take: 1 },
        },
      });
      if (!current) return bad('Booking not found.', 404);

      // Full catalogue price for the next visit — one-time promo/welcome
      // discounts baked into THIS booking's pricePence must not recur.
      const nextPrice = current.items[0]?.pricePence ?? current.pricePence;

      const { isSlotFree, pickPractitioner, assignResources } = await import('@/lib/availability');
      if (!(await isSlotFree(startISO, current.durationMin, current.treatmentSlug))) {
        return bad('That time has just been taken — pick another.');
      }
      const { getSetting } = await import('@/lib/settings');
      const autoAssign = await getSetting('auto_assign_practitioner');
      const practitionerId = autoAssign ? await pickPractitioner(startISO, current.durationMin, current.treatmentSlug, current.locationId).catch(() => null) : null;
      const resourceIds = await assignResources(startISO, current.durationMin, current.treatmentSlug, current.locationId).catch(() => [] as string[]);

      const end = new Date(start.getTime() + current.durationMin * 60_000);
      const endBuffered = new Date(end.getTime() + (current.bufferMin ?? 0) * 60_000);
      let next: { id: string; startAt: Date; status: string } | null = null;
      try {
        // Same overlap re-check inside a Serializable transaction as the
        // public create route — plain check-then-create is a known TOCTOU.
        next = await db.$transaction(async (tx) => {
          const overlapping = await tx.booking.findMany({
            where: { status: { in: ['PENDING', 'CONFIRMED'] }, startAt: { lt: endBuffered }, endAt: { gt: start } },
            select: { practitionerId: true, resources: { select: { id: true } } },
          });
          const practitionerClash = !!practitionerId && overlapping.some((b) => b.practitionerId === practitionerId);
          const resourceClash = resourceIds.length > 0 && overlapping.some((b) => b.resources.some((r) => resourceIds.includes(r.id)));
          if (practitionerClash || resourceClash) return null;
          return tx.booking.create({
            data: {
              clientId: current.clientId,
              treatmentSlug: current.treatmentSlug, treatmentTitle: current.treatmentTitle,
              startAt: start, endAt: end,
              durationMin: current.durationMin, bufferMin: current.bufferMin,
              pricePence: nextPrice,
              // The card saved for THIS visit carries over — confirmed instantly.
              stripeCustomerId: current.stripeCustomerId, stripePaymentMethodId: current.stripePaymentMethodId,
              status: current.stripePaymentMethodId ? 'CONFIRMED' : 'PENDING',
              practitionerId, locationId: current.locationId,
              ...(resourceIds.length ? { resources: { connect: resourceIds.map((id) => ({ id })) } } : {}),
              notes: `Rebooked in-session from ${bookingId}`,
            },
            select: { id: true, startAt: true, status: true },
          });
        }, { isolationLevel: 'Serializable' });
      } catch (e) {
        const err = e as { code?: string; message?: string };
        if (err.code === 'P2034' || /write conflict|deadlock|could not serialize/i.test(err.message || '')) {
          return bad('That time was just taken — pick another.', 409);
        }
        throw e;
      }
      if (!next) return bad('That time was just taken — pick another.', 409);

      const row = await db.appointmentSession.findUnique({ where: { bookingId } });
      if (row) {
        const data = { ...((row.data ?? {}) as Data) };
        data['next_visit'] = { value: next.startAt.toISOString(), by: session.email, at: new Date().toISOString() };
        await db.appointmentSession.update({ where: { bookingId }, data: { data: data as object } }).catch(() => {});
      }
      const { logAudit } = await import('@/lib/audit');
      await logAudit({ action: 'BOOKING_CREATED', actor: session.email, actorRole: session.role, bookingId: next.id, clientId: current.clientId, summary: `Next visit booked in-session for ${next.startAt.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} (${next.status})` }).catch(() => {});
      // The confirmation the farewell screen promises — email + .ics + clinic copy.
      if (next.status === 'CONFIRMED') {
        try { const { notifyBookingConfirmed } = await import('@/lib/booking-notify'); await notifyBookingConfirmed(next.id); } catch (e) { console.error('[session] rebook confirmation failed:', (e as Error)?.message); }
      }
      return ok({ nextBookingId: next.id, startAt: next.startAt.toISOString(), status: next.status });
    }

    // Close the session (timings stop). Gated on the treatment actually being
    // finished so completing the visit can never skip finishAppointment's
    // side-effects (status, points, review invite).
    case 'complete': {
      const row = await db.appointmentSession.findUnique({ where: { bookingId } });
      if (!row) return bad('Session not started.', 404);
      if (row.status === 'COMPLETED') return ok();
      if (!booking.finishedAt) return bad('End the treatment first (Treatment step) — that records the visit, points and review invite.');
      await db.appointmentSession.update({
        where: { bookingId },
        data: { status: 'COMPLETED', completedAt: new Date(), steps: closeTimings(normalizeTimings((row.steps ?? {}) as Record<string, Timings[keyof Timings]>)) as object },
      });
      return ok();
    }

    // One-shot snapshot (poll fallback for devices without SSE).
    case 'status': {
      const { sessionSnapshot } = await import('@/lib/appointment-session-server');
      return ok({ snapshot: await sessionSnapshot(bookingId) });
    }

    default:
      return bad('Unknown op.');
  }
}
