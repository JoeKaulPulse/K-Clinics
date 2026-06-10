import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// BLD-138 v2 — realtime appointment-session coordination. The DB row is the
// single source of truth; every device (front desk, host, clinician, checkout)
// reconciles to snapshots over SSE (./stream) with this route as the write
// path. Clinical gates stay in the existing server actions: this route owns
// step timing, staff handoffs (touchpoints), non-clinical answers, the
// checkout charge, the boutique POS hand-off and the next-visit rebook.
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
  const { isSessionStep, advanceTimings, closeTimings } = await import('@/lib/appointment-session');
  const { sessionSnapshot, getStaffProfile, touchpointPatch } = await import('@/lib/appointment-session-server');
  type Timings = import('@/lib/appointment-session').StepTimings;
  type Data = import('@/lib/appointment-session').SessionData;
  type Touchpoints = import('@/lib/appointment-session').Touchpoint[];
  type StepKey = import('@/lib/appointment-session').SessionStepKey;

  const booking = await db.booking.findUnique({ where: { id: bookingId }, select: { id: true, clientId: true, status: true } });
  if (!booking) return bad('Booking not found.', 404);

  const snapshot = () => sessionSnapshot(bookingId);

  switch (op) {
    // Create (or resume) the session; the opener becomes the active staff.
    case 'start': {
      const staff = await getStaffProfile(session.email);
      const existing = await db.appointmentSession.findUnique({ where: { bookingId } });
      if (existing) {
        // Resume — claim presence only if nobody is active yet.
        if (!existing.activeStaffEmail) {
          await db.appointmentSession.update({
            where: { bookingId },
            data: touchpointPatch((existing.touchpoints ?? []) as Touchpoints, existing.currentStep as StepKey, staff),
          });
        }
        return ok({ snapshot: await snapshot() });
      }
      await db.appointmentSession.create({
        data: {
          bookingId, startedBy: session.email,
          steps: advanceTimings({}, 'arrival') as object,
          ...touchpointPatch([], 'arrival', staff),
        },
      });
      const { logAudit } = await import('@/lib/audit');
      await logAudit({ action: 'NOTE_ADDED', actor: session.email, actorRole: session.role, bookingId, clientId: booking.clientId, summary: 'Live session started (client checked in)' }).catch(() => {});
      return ok({ snapshot: await snapshot() });
    }

    // Take over the session on this device (handoff between team members).
    case 'claim': {
      const row = await db.appointmentSession.findUnique({ where: { bookingId } });
      if (!row) return bad('Session not started.', 404);
      const staff = await getStaffProfile(session.email);
      await db.appointmentSession.update({
        where: { bookingId },
        data: touchpointPatch((row.touchpoints ?? []) as Touchpoints, row.currentStep as StepKey, staff),
      });
      return ok({ snapshot: await snapshot() });
    }

    // Record a step transition; the transitioning staff becomes active.
    case 'enter': {
      const step = body.step;
      if (!isSessionStep(step)) return bad('Unknown step.');
      const row = await db.appointmentSession.findUnique({ where: { bookingId } });
      if (!row) return bad('Session not started.', 404);
      if (row.status === 'COMPLETED') return ok({ snapshot: await snapshot() });
      const steps = advanceTimings((row.steps ?? {}) as Timings, step);
      if (body.skippedFrom && isSessionStep(body.skippedFrom)) {
        const t = steps[body.skippedFrom as keyof Timings];
        if (t) steps[body.skippedFrom as keyof Timings] = { ...t, skipped: true };
      }
      const staff = await getStaffProfile(session.email);
      await db.appointmentSession.update({
        where: { bookingId },
        data: { currentStep: step, steps: steps as object, ...touchpointPatch((row.touchpoints ?? []) as Touchpoints, step, staff) },
      });
      return ok({ snapshot: await snapshot() });
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
      return ok({ snapshot: await snapshot() });
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
      return ok({ snapshot: await snapshot() });
    }

    // Next visit: create the follow-on booking for the same treatment, card
    // already on file. Availability, practitioner and room assignment go
    // through the same engine as the public flow.
    case 'rebook': {
      const startISO = String(body.startISO || '');
      const start = new Date(startISO);
      if (!startISO || isNaN(+start) || start <= new Date()) return bad('Pick a future time.');
      const current = await db.booking.findUnique({
        where: { id: bookingId },
        select: {
          clientId: true, treatmentSlug: true, treatmentTitle: true, durationMin: true, bufferMin: true,
          pricePence: true, locationId: true, stripeCustomerId: true, stripePaymentMethodId: true,
          client: { select: { firstName: true } },
        },
      });
      if (!current) return bad('Booking not found.', 404);
      const { isSlotFree, pickPractitioner, assignResources } = await import('@/lib/availability');
      if (!(await isSlotFree(startISO, current.durationMin, current.treatmentSlug))) {
        return bad('That time has just been taken — pick another.');
      }
      const practitionerId = await pickPractitioner(startISO, current.durationMin, current.treatmentSlug, current.locationId).catch(() => null);
      const resourceIds = await assignResources(startISO, current.durationMin, current.treatmentSlug, current.locationId).catch(() => [] as string[]);
      const next = await db.booking.create({
        data: {
          clientId: current.clientId,
          treatmentSlug: current.treatmentSlug, treatmentTitle: current.treatmentTitle,
          startAt: start, endAt: new Date(start.getTime() + current.durationMin * 60_000),
          durationMin: current.durationMin, bufferMin: current.bufferMin,
          pricePence: current.pricePence,
          // The card saved for THIS visit carries over — confirmed instantly.
          stripeCustomerId: current.stripeCustomerId, stripePaymentMethodId: current.stripePaymentMethodId,
          status: current.stripePaymentMethodId ? 'CONFIRMED' : 'PENDING',
          practitionerId, locationId: current.locationId,
          ...(resourceIds.length ? { resources: { connect: resourceIds.map((id) => ({ id })) } } : {}),
          notes: `Rebooked in-session from ${bookingId}`,
        },
        select: { id: true, startAt: true, status: true },
      });
      const row = await db.appointmentSession.findUnique({ where: { bookingId } });
      if (row) {
        const data = { ...((row.data ?? {}) as Data) };
        data['next_visit'] = { value: next.startAt.toISOString(), by: session.email, at: new Date().toISOString() };
        await db.appointmentSession.update({ where: { bookingId }, data: { data: data as object } }).catch(() => {});
      }
      const { logAudit } = await import('@/lib/audit');
      await logAudit({ action: 'BOOKING_CREATED', actor: session.email, actorRole: session.role, bookingId: next.id, clientId: current.clientId, summary: `Next visit booked in-session for ${next.startAt.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} (${next.status})` }).catch(() => {});
      return ok({ nextBookingId: next.id, startAt: next.startAt.toISOString(), status: next.status, snapshot: await snapshot() });
    }

    // Close the session (timings stop). finishAppointment ran at end-of-treatment.
    case 'complete': {
      const row = await db.appointmentSession.findUnique({ where: { bookingId } });
      if (!row) return bad('Session not started.', 404);
      if (row.status === 'COMPLETED') return ok({ snapshot: await snapshot() });
      await db.appointmentSession.update({
        where: { bookingId },
        data: { status: 'COMPLETED', completedAt: new Date(), steps: closeTimings((row.steps ?? {}) as Timings) as object },
      });
      return ok({ snapshot: await snapshot() });
    }

    // One-shot snapshot (poll fallback for devices without SSE).
    case 'status': {
      return ok({ snapshot: await snapshot() });
    }

    default:
      return bad('Unknown op.');
  }
}
