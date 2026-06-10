import 'server-only';
import crypto from 'node:crypto';
import { db } from '@/lib/db';
import type { SessionStepKey, StepTimings, SessionData, Touchpoint } from '@/lib/appointment-session';

// BLD-138 v2 — shared server helpers for the realtime appointment session.
// One snapshot shape feeds every consumer: the staff runner (any device), the
// staff SSE stream, and the client's live phone page (sanitised). The DB row
// is the single source of truth; devices reconcile to snapshots.

export type StaffProfile = { email: string; name: string; title: string | null; photo: string | null };

export async function getStaffProfile(email: string): Promise<StaffProfile> {
  try {
    const u = await db.adminUser.findUnique({ where: { email }, select: { name: true, title: true, photoUrl: true } });
    return { email, name: u?.name || email.split('@')[0], title: u?.title ?? null, photo: u?.photoUrl ?? null };
  } catch {
    return { email, name: email.split('@')[0], title: null, photo: null };
  }
}

export type SessionSnapshot = {
  /** Hash of the meaningful state — SSE pushes only when it changes. */
  rev: string;
  session: {
    status: string;
    currentStep: SessionStepKey | string;
    steps: StepTimings;
    data: SessionData;
    touchpoints: Touchpoint[];
    activeStaff: { email: string; name: string; title: string | null; photo: string | null } | null;
    startedAt: string;
    completedAt: string | null;
  } | null;
  booking: {
    status: string;
    startedAt: string | null;
    finishedAt: string | null;
    actualMinutes: number | null;
    aftercareAckAt: string | null;
    sopAcknowledgedAt: string | null;
    medicalFlagReviewedAt: string | null;
    chargedPence: number | null;
    chargedAt: string | null;
    pricePence: number;
  };
  consentSigned: boolean;
  consents: { kind: string; title: string; signedAt: string; cert: string }[];
  hasBeforePhoto: boolean;
};

export async function sessionSnapshot(bookingId: string): Promise<SessionSnapshot | null> {
  const [b, s, signed, beforePhoto] = await Promise.all([
    db.booking.findUnique({
      where: { id: bookingId },
      select: {
        status: true, startedAt: true, finishedAt: true, actualMinutes: true, aftercareAckAt: true,
        sopAcknowledgedAt: true, medicalFlagReviewedAt: true, chargedPence: true, chargedAt: true, pricePence: true,
      },
    }),
    db.appointmentSession.findUnique({ where: { bookingId } }),
    db.signedConsent.findMany({ where: { bookingId }, orderBy: { signedAt: 'desc' }, select: { kind: true, title: true, signedAt: true, contentHash: true } }),
    db.beforePhoto.findFirst({ where: { bookingId }, select: { id: true } }),
  ]);
  if (!b) return null;

  const snap: Omit<SessionSnapshot, 'rev'> = {
    session: s ? {
      status: s.status,
      currentStep: s.currentStep,
      steps: (s.steps ?? {}) as StepTimings,
      data: (s.data ?? {}) as SessionData,
      touchpoints: (s.touchpoints ?? []) as Touchpoint[],
      activeStaff: s.activeStaffEmail ? { email: s.activeStaffEmail, name: s.activeStaffName || s.activeStaffEmail, title: s.activeStaffTitle, photo: s.activeStaffPhoto } : null,
      startedAt: s.startedAt.toISOString(),
      completedAt: s.completedAt?.toISOString() ?? null,
    } : null,
    booking: {
      status: b.status,
      startedAt: b.startedAt?.toISOString() ?? null,
      finishedAt: b.finishedAt?.toISOString() ?? null,
      actualMinutes: b.actualMinutes,
      aftercareAckAt: b.aftercareAckAt?.toISOString() ?? null,
      sopAcknowledgedAt: b.sopAcknowledgedAt?.toISOString() ?? null,
      medicalFlagReviewedAt: b.medicalFlagReviewedAt?.toISOString() ?? null,
      chargedPence: b.chargedPence,
      chargedAt: b.chargedAt?.toISOString() ?? null,
      pricePence: b.pricePence,
    },
    consentSigned: signed.some((x) => x.kind === 'treatment'),
    consents: signed.map((x) => ({ kind: x.kind, title: x.title, signedAt: x.signedAt.toISOString(), cert: x.contentHash.slice(0, 12) })),
    hasBeforePhoto: !!beforePhoto || signed.some((x) => x.kind === 'photo_opt_out'),
  };
  // Stored timings only change on transitions (open-step seconds are derived
  // client-side from enteredAt), so the hash moves exactly when state moves.
  const rev = crypto.createHash('sha1').update(JSON.stringify(snap)).digest('hex').slice(0, 16);
  return { rev, ...snap };
}

/** What the CLIENT's phone may see — no emails, no clinical/gate detail. */
export type ClientLiveView = {
  rev: string;
  status: string;
  stage: string;
  startedAt: string | null;
  finishedAt: boolean;
  with: { name: string; title: string | null; photo: string | null } | null;
  journey: { at: string; step: string; name: string; title: string | null; photo: string | null }[];
};

export function clientView(snap: SessionSnapshot): ClientLiveView {
  return {
    rev: snap.rev,
    status: snap.session?.status ?? 'PENDING',
    stage: snap.session?.currentStep ?? 'arrival',
    startedAt: snap.session?.startedAt ?? null,
    finishedAt: !!snap.booking.finishedAt,
    with: snap.session?.activeStaff ? { name: snap.session.activeStaff.name, title: snap.session.activeStaff.title, photo: snap.session.activeStaff.photo } : null,
    journey: (snap.session?.touchpoints ?? []).map((t) => ({ at: t.at, step: t.step, name: t.staffName, title: t.staffTitle ?? null, photo: t.staffPhoto ?? null })),
  };
}

/** Append a touchpoint when the (staff, step) pair actually changes, and set
 *  the active-staff fields. Returns the data patch for the update call. */
export function touchpointPatch(existing: Touchpoint[], step: SessionStepKey, staff: StaffProfile) {
  const last = existing[existing.length - 1];
  const changed = !last || last.staffEmail !== staff.email || last.step !== step;
  const touchpoints = changed
    ? [...existing, { at: new Date().toISOString(), step, staffEmail: staff.email, staffName: staff.name, staffTitle: staff.title, staffPhoto: staff.photo } satisfies Touchpoint]
    : existing;
  return {
    activeStaffEmail: staff.email,
    activeStaffName: staff.name,
    activeStaffTitle: staff.title,
    activeStaffPhoto: staff.photo,
    touchpoints: touchpoints as object,
  };
}
