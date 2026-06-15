import 'server-only';
import crypto from 'node:crypto';
import { db } from '@/lib/db';
import { normalizeStepKey, normalizeTimings } from '@/lib/appointment-session';
import type { SessionStepKey, StepTimings, SessionData, Touchpoint } from '@/lib/appointment-session';

// BLD-138 v2 — shared server helpers for the realtime appointment session.
// One snapshot shape feeds every consumer: the staff runner (any device), the
// staff SSE stream, and the client's live phone page (sanitised). The DB row
// is the single source of truth; devices reconcile to snapshots. The active
// staff member is DERIVED from the tail of the append-only touchpoints log —
// one record of truth, nothing to desynchronise.

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
    currentStep: SessionStepKey;
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
    items: { label: string; pricePence: number; discountPence: number; isAddon: boolean; sessions: number }[];
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
        items: { orderBy: { createdAt: 'asc' }, select: { label: true, pricePence: true, discountPence: true, isAddon: true, sessions: true } },
      },
    }),
    db.appointmentSession.findUnique({ where: { bookingId } }),
    db.signedConsent.findMany({ where: { bookingId }, orderBy: { signedAt: 'desc' }, select: { kind: true, title: true, signedAt: true, contentHash: true } }),
    db.beforePhoto.findFirst({ where: { bookingId }, select: { id: true } }),
  ]);
  if (!b) return null;

  const touchpoints = ((s?.touchpoints ?? []) as Touchpoint[]).map((t) => ({ ...t, step: normalizeStepKey(t.step) }));
  const last = touchpoints[touchpoints.length - 1];

  const snap: Omit<SessionSnapshot, 'rev'> = {
    session: s ? {
      status: s.status,
      currentStep: normalizeStepKey(s.currentStep),
      steps: normalizeTimings((s.steps ?? {}) as Record<string, StepTimings[SessionStepKey]>),
      data: (s.data ?? {}) as SessionData,
      touchpoints,
      // Presence = the last handoff; cleared once the visit completes.
      activeStaff: last && s.status !== 'COMPLETED'
        ? { email: last.staffEmail, name: last.staffName, title: last.staffTitle ?? null, photo: last.staffPhoto ?? null }
        : null,
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
      items: b.items,
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

/** Cheap change probe for the SSE poll loops: three trivial indexed reads
 *  instead of the full four-query snapshot build + hash on every tick. The
 *  full snapshot is built only when this string moves. */
export async function sessionProbe(bookingId: string): Promise<string | null> {
  const [b, consentCount, photoCount] = await Promise.all([
    db.booking.findUnique({ where: { id: bookingId }, select: { updatedAt: true, liveSession: { select: { updatedAt: true } } } }),
    db.signedConsent.count({ where: { bookingId } }),
    db.beforePhoto.count({ where: { bookingId } }),
  ]);
  if (!b) return null;
  return `${+b.updatedAt}|${b.liveSession ? +b.liveSession.updatedAt : 0}|${consentCount}|${photoCount}`;
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
  // What the client will pay: each line (primary + add-ons) at its actual charge
  // (net of any discount), the total their card will be charged, and — once taken
  // — the amount actually charged. Add-ons are flagged so the phone can label them.
  pricing: {
    items: { label: string; pricePence: number; isAddon: boolean; sessions: number }[];
    totalPence: number;
    chargedPence: number | null;
  };
};

export function clientView(snap: SessionSnapshot): ClientLiveView {
  const a = snap.session?.activeStaff;
  return {
    rev: snap.rev,
    status: snap.session?.status ?? 'PENDING',
    stage: snap.session?.currentStep ?? 'arrival',
    startedAt: snap.session?.startedAt ?? null,
    finishedAt: !!snap.booking.finishedAt,
    with: a ? { name: a.name, title: a.title, photo: a.photo } : null,
    journey: (snap.session?.touchpoints ?? []).map((t) => ({ at: t.at, step: t.step, name: t.staffName, title: t.staffTitle ?? null, photo: t.staffPhoto ?? null })),
    pricing: {
      items: snap.booking.items.map((it) => ({ label: it.label, pricePence: Math.max(0, it.pricePence - it.discountPence), isAddon: it.isAddon, sessions: it.sessions })),
      totalPence: snap.booking.pricePence,
      chargedPence: snap.booking.chargedPence,
    },
  };
}

/** Append a touchpoint when the (staff, step) pair actually changes. The
 *  touchpoints log is the single record of presence — the active staff member
 *  is always derived from its tail. */
export function touchpointAppend(existing: Touchpoint[], step: SessionStepKey, staff: StaffProfile): { touchpoints: object } {
  const last = existing[existing.length - 1];
  const changed = !last || last.staffEmail !== staff.email || normalizeStepKey(last.step) !== step;
  const touchpoints = changed
    ? [...existing, { at: new Date().toISOString(), step, staffEmail: staff.email, staffName: staff.name, staffTitle: staff.title, staffPhoto: staff.photo } satisfies Touchpoint]
    : existing;
  return { touchpoints: touchpoints as object };
}
