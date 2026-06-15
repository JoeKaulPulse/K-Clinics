// BLD-138 — the interactive appointment session's step sequence. Shared by the
// server (timing bookkeeping, API validation) and the client runner (rail,
// transitions). Order mirrors the client's physical journey through the clinic:
// front-desk arrival through to leaving. Keep this dependency-free so it can be
// imported from client components.

export type SessionStepKey = 'arrival' | 'safety' | 'consent' | 'treatment' | 'aftercare' | 'checkout' | 'nextvisit' | 'farewell';

export type SessionStepDef = {
  key: SessionStepKey;
  /** Short label for the step rail. */
  label: string;
  /** Editorial kicker shown above the step title. */
  kicker: string;
  /** Large display title. {name} is replaced with the client's first name. */
  title: string;
  /** Safe to leave on screen while the client is watching. Steps that surface
   *  staff-only clinical context (medical flag, SOP) are not. */
  clientFacing: boolean;
};

export const SESSION_STEPS: SessionStepDef[] = [
  { key: 'arrival',   label: 'Arrival',    kicker: 'Welcome',            title: 'Welcome, {name}.',            clientFacing: true },
  { key: 'safety',    label: 'Safety',     kicker: 'Clinical readiness', title: 'Safety & readiness.',         clientFacing: false },
  { key: 'consent',   label: 'Consent',    kicker: 'Your agreement',     title: 'Informed consent.',           clientFacing: true },
  { key: 'treatment', label: 'Treatment',  kicker: 'In the chair',       title: 'Your treatment.',             clientFacing: true },
  { key: 'aftercare', label: 'Aftercare',  kicker: 'Caring for results', title: 'Aftercare that protects it.', clientFacing: true },
  { key: 'checkout',  label: 'Checkout',   kicker: 'Settling up',        title: 'Effortless checkout.',        clientFacing: true },
  { key: 'nextvisit', label: 'Next visit', kicker: 'Keeping momentum',   title: 'Your next visit.',            clientFacing: true },
  { key: 'farewell',  label: 'Farewell',   kicker: 'Until next time',    title: 'Thank you, {name}.',          clientFacing: true },
];

/** Friendly stage copy for the CLIENT's live phone page — warmer, second person. */
export const CLIENT_STAGE_COPY: Record<SessionStepKey, { title: string; note: string }> = {
  arrival:   { title: 'You’ve arrived',          note: 'Settle in — we’re getting everything ready for you.' },
  safety:    { title: 'Preparing your room',     note: 'Your clinician is reviewing your records and preparing the room.' },
  consent:   { title: 'Your consent',            note: 'We’ll walk you through the consent form together.' },
  treatment: { title: 'Your treatment',          note: 'You’re in expert hands — relax and enjoy.' },
  aftercare: { title: 'Aftercare',               note: 'Your personal aftercare plan, explained step by step.' },
  checkout:  { title: 'Settling up',             note: 'Payment and anything you’d like to take home.' },
  nextvisit: { title: 'Planning your next visit', note: 'Locking in the timing that protects your results.' },
  farewell:  { title: 'Until next time',         note: 'Thank you for visiting KClinics today.' },
};

export const SESSION_STEP_KEYS = SESSION_STEPS.map((s) => s.key);

// BLD-202 — which station each step belongs to. The owner's split: Reception
// handles arrival and the wrap-up (checkout / next visit / farewell); the Room
// handles the clinical middle (safety / consent / treatment / aftercare). One
// session + one step sequence is kept; a device just picks which station it is.
export type SessionStation = 'reception' | 'room';
export type StationMode = 'full' | SessionStation;

export const STEP_STATION: Record<SessionStepKey, SessionStation> = {
  arrival: 'reception',
  safety: 'room',
  consent: 'room',
  treatment: 'room',
  aftercare: 'room',
  checkout: 'reception',
  nextvisit: 'reception',
  farewell: 'reception',
};

export const STATION_LABEL: Record<SessionStation, string> = { reception: 'Reception', room: 'Room' };

/** Does a step show full-size on a device set to this station mode? */
export const stepActiveAtStation = (step: SessionStepKey, mode: StationMode): boolean =>
  mode === 'full' || STEP_STATION[step] === mode;

export function isSessionStep(v: unknown): v is SessionStepKey {
  return typeof v === 'string' && (SESSION_STEP_KEYS as string[]).includes(v);
}

// v1 shipped a 'wrap' step that v2 split into checkout/nextvisit/farewell.
// In-flight sessions from before the rename are normalised at every read
// boundary so they resume where they left off instead of resetting to arrival.
const LEGACY_STEP_MAP: Record<string, SessionStepKey> = { wrap: 'farewell' };

export function normalizeStepKey(v: unknown): SessionStepKey {
  if (isSessionStep(v)) return v;
  if (typeof v === 'string' && LEGACY_STEP_MAP[v]) return LEGACY_STEP_MAP[v];
  return 'arrival';
}

/** Remap legacy keys inside a stored timing map (merges seconds/visits). */
export function normalizeTimings(timings: Record<string, StepTiming | undefined>): StepTimings {
  const out: StepTimings = {};
  for (const [k, t] of Object.entries(timings)) {
    if (!t) continue;
    const key = normalizeStepKey(k);
    const prev = out[key];
    out[key] = prev
      ? { enteredAt: prev.enteredAt ?? t.enteredAt, seconds: prev.seconds + t.seconds, visits: prev.visits + t.visits, ...(prev.skipped || t.skipped ? { skipped: true } : {}) }
      : t;
  }
  return out;
}

/** Per-step timing entry stored in AppointmentSession.steps. */
export type StepTiming = { enteredAt: string | null; seconds: number; visits: number; skipped?: boolean };
export type StepTimings = Partial<Record<SessionStepKey, StepTiming>>;

/** Captured non-clinical answer stored in AppointmentSession.data. */
export type SessionField = { value: string; by: string; at: string };
export type SessionData = Record<string, SessionField>;

/** A staff handoff record stored in AppointmentSession.touchpoints (append-only). */
export type Touchpoint = { at: string; step: SessionStepKey; staffEmail: string; staffName: string; staffTitle?: string | null; staffPhoto?: string | null };

/** Close the currently-open step (if any) and open `next`, returning new map. */
export function advanceTimings(timings: StepTimings, next: SessionStepKey, now = new Date()): StepTimings {
  const out: StepTimings = { ...timings };
  for (const key of SESSION_STEP_KEYS) {
    const t = out[key];
    if (t?.enteredAt) {
      const secs = Math.max(0, Math.round((now.getTime() - new Date(t.enteredAt).getTime()) / 1000));
      out[key] = { ...t, enteredAt: null, seconds: t.seconds + secs };
    }
  }
  const prev = out[next];
  out[next] = { enteredAt: now.toISOString(), seconds: prev?.seconds ?? 0, visits: (prev?.visits ?? 0) + 1, ...(prev?.skipped ? { skipped: prev.skipped } : {}) };
  return out;
}

/** Close every open step (used on completion). */
export function closeTimings(timings: StepTimings, now = new Date()): StepTimings {
  const out: StepTimings = { ...timings };
  for (const key of SESSION_STEP_KEYS) {
    const t = out[key];
    if (t?.enteredAt) {
      const secs = Math.max(0, Math.round((now.getTime() - new Date(t.enteredAt).getTime()) / 1000));
      out[key] = { ...t, enteredAt: null, seconds: t.seconds + secs };
    }
  }
  return out;
}
