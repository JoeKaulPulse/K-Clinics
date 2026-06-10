// BLD-138 — the interactive appointment session's step sequence. Shared by the
// server (timing bookkeeping, API validation) and the client runner (rail,
// transitions). Order mirrors the client's physical journey through the clinic:
// front-desk arrival through to leaving. Keep this dependency-free so it can be
// imported from client components.

export type SessionStepKey = 'arrival' | 'safety' | 'consent' | 'treatment' | 'aftercare' | 'wrap';

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
  { key: 'arrival',   label: 'Arrival',   kicker: 'Welcome',            title: 'Welcome, {name}.',            clientFacing: true },
  { key: 'safety',    label: 'Safety',    kicker: 'Clinical readiness', title: 'Safety & readiness.',         clientFacing: false },
  { key: 'consent',   label: 'Consent',   kicker: 'Your agreement',     title: 'Informed consent.',           clientFacing: true },
  { key: 'treatment', label: 'Treatment', kicker: 'In the chair',       title: 'Your treatment.',             clientFacing: true },
  { key: 'aftercare', label: 'Aftercare', kicker: 'Caring for results', title: 'Aftercare that protects it.', clientFacing: true },
  { key: 'wrap',      label: 'Wrap-up',   kicker: 'Before you go',      title: 'All wrapped up.',             clientFacing: true },
];

export const SESSION_STEP_KEYS = SESSION_STEPS.map((s) => s.key);

export function isSessionStep(v: unknown): v is SessionStepKey {
  return typeof v === 'string' && (SESSION_STEP_KEYS as string[]).includes(v);
}

/** Per-step timing entry stored in AppointmentSession.steps. */
export type StepTiming = { enteredAt: string | null; seconds: number; visits: number; skipped?: boolean };
export type StepTimings = Partial<Record<SessionStepKey, StepTiming>>;

/** Captured non-clinical answer stored in AppointmentSession.data. */
export type SessionField = { value: string; by: string; at: string };
export type SessionData = Record<string, SessionField>;

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
