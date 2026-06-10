import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// BLD-138 — interactive appointment session bookkeeping. The session is the
// choreography layer over the existing clinical actions: medical review, SOP,
// start/finish and the clinical note all go through their established
// gate-checked server actions; this route only owns per-step timing, the
// non-clinical captured answers (audited on edit) and live status for polling.
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
  type Timings = import('@/lib/appointment-session').StepTimings;
  type Data = import('@/lib/appointment-session').SessionData;

  const booking = await db.booking.findUnique({ where: { id: bookingId }, select: { id: true, clientId: true, status: true } });
  if (!booking) return bad('Booking not found.', 404);

  switch (op) {
    // Create (or resume) the session for this booking.
    case 'start': {
      const existing = await db.appointmentSession.findUnique({ where: { bookingId } });
      if (existing) return ok({ session: existing });
      const created = await db.appointmentSession.create({
        data: { bookingId, startedBy: session.email, steps: advanceTimings({}, 'arrival') as object },
      });
      return ok({ session: created });
    }

    // Record a step transition (closes the open step's clock, opens the next).
    case 'enter': {
      const step = body.step;
      if (!isSessionStep(step)) return bad('Unknown step.');
      const row = await db.appointmentSession.findUnique({ where: { bookingId } });
      if (!row) return bad('Session not started.', 404);
      if (row.status === 'COMPLETED') return ok({ session: row });
      const steps = advanceTimings((row.steps ?? {}) as Timings, step);
      if (body.skippedFrom && isSessionStep(body.skippedFrom)) {
        const t = steps[body.skippedFrom as keyof Timings];
        if (t) steps[body.skippedFrom as keyof Timings] = { ...t, skipped: true };
      }
      const updated = await db.appointmentSession.update({ where: { bookingId }, data: { currentStep: step, steps: steps as object } });
      return ok({ session: updated });
    }

    // Save a non-clinical captured answer. Changing an already-saved value is
    // audit-logged (field name only — values stay out of the audit trail).
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
      return ok();
    }

    // Close the session (timings stop). Finishing the appointment itself
    // (status, loyalty, review request) goes through finishAppointment.
    case 'complete': {
      const row = await db.appointmentSession.findUnique({ where: { bookingId } });
      if (!row) return bad('Session not started.', 404);
      if (row.status === 'COMPLETED') return ok({ session: row });
      const updated = await db.appointmentSession.update({
        where: { bookingId },
        data: { status: 'COMPLETED', completedAt: new Date(), steps: closeTimings((row.steps ?? {}) as Timings) as object },
      });
      return ok({ session: updated });
    }

    // Live status for in-step polling (consent signing, photo capture).
    case 'status': {
      const [b, signed, beforePhoto] = await Promise.all([
        db.booking.findUnique({ where: { id: bookingId }, select: { startedAt: true, finishedAt: true, actualMinutes: true, aftercareAckAt: true, sopAcknowledgedAt: true, medicalFlagReviewedAt: true } }),
        db.signedConsent.findMany({ where: { bookingId }, select: { kind: true, title: true, signedAt: true, contentHash: true } }),
        db.beforePhoto.findFirst({ where: { bookingId }, select: { id: true } }),
      ]);
      return ok({
        startedAt: b?.startedAt?.toISOString() ?? null,
        finishedAt: b?.finishedAt?.toISOString() ?? null,
        actualMinutes: b?.actualMinutes ?? null,
        aftercareAckAt: b?.aftercareAckAt?.toISOString() ?? null,
        sopAcknowledgedAt: b?.sopAcknowledgedAt?.toISOString() ?? null,
        medicalFlagReviewedAt: b?.medicalFlagReviewedAt?.toISOString() ?? null,
        consentSigned: signed.some((s) => s.kind === 'treatment'),
        consents: signed.map((s) => ({ kind: s.kind, title: s.title, signedAt: s.signedAt.toISOString(), cert: s.contentHash.slice(0, 12) })),
        hasBeforePhoto: !!beforePhoto,
      });
    }

    default:
      return bad('Unknown op.');
  }
}
