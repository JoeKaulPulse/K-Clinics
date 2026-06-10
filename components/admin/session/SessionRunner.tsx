'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { SESSION_STEPS, closeTimings, type SessionStepKey, type StepTimings } from '@/lib/appointment-session';
import { reviewMedicalFlag, saveSopChecklist, startAppointment, finishAppointment, saveClinicalNote } from '@/app/admin/bookings/clinical-actions';

// BLD-138 — the live appointment session runner. One screen, six sequenced
// steps that mirror the client's journey through the clinic. The clinician
// drives; "Present" turns the screen client-safe (staff-only context hidden,
// type enlarged). Every step's dwell time is recorded server-side for the
// operations analytics. Clinical gates stay in the existing server actions.

type SopItem = { step: string; checked: boolean; response?: string };

type Props = {
  baseUrl: string;
  booking: {
    id: string; treatmentTitle: string; treatmentSlug: string; startAt: string; durationMin: number; status: string;
    startedAt: string | null; finishedAt: string | null; actualMinutes: number | null; aftercareAckAt: string | null;
    sopAcknowledgedAt: string | null; medicalFlagReviewedAt: string | null;
    refreshments: string[]; addOns: string[];
  };
  client: { firstName: string; fullName: string; medicalFlag: string | null; allergyNote: string | null };
  practitionerName: string | null;
  sop: { title: string; steps: { step: string; capture: boolean }[]; saved: SopItem[] | null };
  consent: {
    required: boolean; templateKey: string | null; templateTitle: string | null;
    signed: { title: string; signedAt: string; cert: string }[];
    pendingToken: string | null;
  };
  gates: { requireSop: boolean; requireMedical: boolean; requireBeforePhoto: boolean; hasBeforePhoto: boolean; isLaser: boolean };
  canClinical: boolean;
  clinicalNote: string;
  clientId: string;
  aftercare: { title: string; intro: string; items: { icon: string; text: string }[] };
  existingSession: { status: string; currentStep: string; steps: StepTimings; data: Record<string, { value: string; by: string; at: string }> } | null;
};

const fmtClock = (totalSeconds: number) => {
  const m = Math.floor(totalSeconds / 60); const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export function SessionRunner(p: Props) {
  const reduce = useReducedMotion();
  const stepIndex = (k: SessionStepKey) => SESSION_STEPS.findIndex((s) => s.key === k);
  const initialStep = (p.existingSession && SESSION_STEPS.some((s) => s.key === p.existingSession!.currentStep)
    ? p.existingSession.currentStep : 'arrival') as SessionStepKey;

  const [step, setStep] = useState<SessionStepKey>(initialStep);
  const [presenting, setPresenting] = useState(false);
  const [timings, setTimings] = useState<StepTimings>(p.existingSession?.steps ?? {});
  const [sessionStarted, setSessionStarted] = useState(!!p.existingSession);
  const [sessionDone, setSessionDone] = useState(p.existingSession?.status === 'COMPLETED');
  const [err, setErr] = useState('');
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());

  // Live booking status (refreshed after actions + polled on the consent step).
  const [live, setLive] = useState({
    startedAt: p.booking.startedAt, finishedAt: p.booking.finishedAt, actualMinutes: p.booking.actualMinutes,
    aftercareAckAt: p.booking.aftercareAckAt, sopAcknowledgedAt: p.booking.sopAcknowledgedAt,
    medicalFlagReviewedAt: p.booking.medicalFlagReviewedAt,
    consentSigned: p.consent.signed.length > 0,
    consents: p.consent.signed.map((s) => ({ ...s, kind: 'treatment' })),
    hasBeforePhoto: p.gates.hasBeforePhoto,
  });

  const api = useCallback(async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/admin/bookings/session', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: p.booking.id, ...payload }),
    });
    return res.json().catch(() => ({ ok: false, error: 'Network error.' }));
  }, [p.booking.id]);

  const refreshStatus = useCallback(async () => {
    const j = await api({ op: 'status' });
    if (j.ok) setLive((s) => ({ ...s, ...j, consents: j.consents ?? s.consents }));
  }, [api]);

  // Start (or resume) the session record on mount.
  useEffect(() => {
    if (sessionStarted) return;
    api({ op: 'start' }).then((j) => {
      if (j.ok) { setSessionStarted(true); if (j.session?.steps) setTimings(j.session.steps); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 1s tick drives the visible clocks.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Poll while waiting for an on-device/phone signature on the consent step.
  useEffect(() => {
    if (step !== 'consent' || live.consentSigned) return;
    const id = setInterval(refreshStatus, 5000);
    return () => clearInterval(id);
  }, [step, live.consentSigned, refreshStatus]);

  // Esc leaves presentation mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPresenting(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const goTo = useCallback((next: SessionStepKey, opts: { skip?: boolean } = {}) => {
    if (sessionDone) { setStep(next); return; }
    setErr('');
    const from = step;
    setStep(next);
    setTimings((t) => {
      // Mirror the server's bookkeeping locally so the rail updates instantly.
      const out: StepTimings = { ...t };
      const cur = out[from];
      if (cur?.enteredAt) {
        const secs = Math.max(0, Math.round((Date.now() - new Date(cur.enteredAt).getTime()) / 1000));
        out[from] = { ...cur, enteredAt: null, seconds: cur.seconds + secs, ...(opts.skip ? { skipped: true } : {}) };
      }
      const prev = out[next];
      out[next] = { enteredAt: new Date().toISOString(), seconds: prev?.seconds ?? 0, visits: (prev?.visits ?? 0) + 1 };
      return out;
    });
    api({ op: 'enter', step: next, ...(opts.skip ? { skippedFrom: from } : {}) }).catch(() => {});
  }, [api, step, sessionDone]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setErr('');
      const r = await fn();
      if (!r.ok) setErr(r.error || 'That didn’t work — please try again.');
      await refreshStatus();
    });

  // Derived timing helpers.
  const stepSeconds = (k: SessionStepKey) => {
    const t = timings[k];
    if (!t) return 0;
    const open = t.enteredAt ? Math.max(0, Math.round((now - new Date(t.enteredAt).getTime()) / 1000)) : 0;
    return t.seconds + open;
  };
  const treatmentElapsed = live.startedAt
    ? (live.finishedAt
        ? Math.max(0, Math.round((new Date(live.finishedAt).getTime() - new Date(live.startedAt).getTime()) / 1000))
        : Math.max(0, Math.floor((now - new Date(live.startedAt).getTime()) / 1000)))
    : 0;

  const idx = stepIndex(step);
  const def = SESSION_STEPS[idx];
  const clientSafe = def.clientFacing;

  // Pre-treatment gates for the Start button (mirrors startAppointment's checks).
  const flagOk = !p.client.medicalFlag || !p.gates.requireMedical || !!live.medicalFlagReviewedAt;
  const sopOk = !p.gates.requireSop || !!live.sopAcknowledgedAt;
  const consentOk = !p.consent.required || live.consentSigned;
  const photoOk = !p.gates.requireBeforePhoto || live.hasBeforePhoto;
  const canStart = flagOk && sopOk && consentOk && photoOk;

  const fade = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } }
    : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] as const } };

  return (
    <div className={presenting ? 'session-presenting' : ''}>
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-[var(--color-line)] bg-[var(--color-porcelain)]/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          {presenting ? <span aria-hidden className="w-20" /> : (
            <Link href={`/admin/bookings/${p.booking.id}`} className="rounded-full px-3 py-2 text-sm text-[var(--color-stone)] transition-colors hover:text-[var(--color-ink)]">
              ← Booking
            </Link>
          )}
          <p className="min-w-0 truncate text-center text-sm">
            <span className="font-medium">{presenting ? p.client.firstName : p.client.fullName}</span>
            <span className="text-[var(--color-stone)]"> · {p.booking.treatmentTitle}</span>
          </p>
          <div className="flex items-center gap-2">
            {live.startedAt && !live.finishedAt && (
              <span className="hidden items-center gap-2 rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs text-[var(--color-porcelain)] sm:flex">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-gold-bright)]" aria-hidden />
                <span className="tabular-nums">{fmtClock(treatmentElapsed)}</span>
              </span>
            )}
            <button
              type="button"
              onClick={() => setPresenting((v) => !v)}
              aria-pressed={presenting}
              className={`min-h-11 rounded-full border px-4 py-2 text-sm transition-colors ${presenting
                ? 'border-[var(--color-gold)] bg-[var(--color-gold)] text-white'
                : 'border-[var(--color-line)] text-[var(--color-ink)] hover:border-[var(--color-gold)]'}`}
            >
              {presenting ? 'Presenting' : 'Present'}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-10 px-4 pb-24 pt-8 sm:px-6 lg:pt-12">
        {/* ── Step rail (desktop) ─────────────────────────────────────────── */}
        <nav aria-label="Session steps" className="sticky top-24 hidden h-fit w-52 shrink-0 lg:block">
          <ol className="space-y-1">
            {SESSION_STEPS.map((s, i) => {
              const state = i < idx ? 'done' : i === idx ? 'current' : 'todo';
              const secs = stepSeconds(s.key);
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => goTo(s.key)}
                    aria-current={state === 'current' ? 'step' : undefined}
                    className={`group flex w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-left transition-colors ${state === 'current' ? 'bg-[var(--color-bone)]' : 'hover:bg-[var(--color-bone)]/60'}`}
                  >
                    <span aria-hidden className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[10px] transition-colors ${
                      state === 'done' ? 'border-[var(--color-gold)] bg-[var(--color-gold)] text-white'
                      : state === 'current' ? 'border-[var(--color-gold)] text-[var(--color-gold)]'
                      : 'border-[var(--color-line)] text-[var(--color-stone)]'}`}>
                      {state === 'done' ? <CheckIcon /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm ${state === 'current' ? 'font-medium text-[var(--color-ink)]' : 'text-[var(--color-stone)]'}`}>{s.label}</span>
                    </span>
                    {!presenting && secs > 0 && (
                      <span className="text-[11px] tabular-nums text-[var(--color-stone)]">{fmtClock(secs)}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* ── Step content ───────────────────────────────────────────────── */}
        <div className="min-w-0 flex-1">
          {/* Mobile progress dots */}
          <ol aria-hidden className="mb-8 flex items-center justify-center gap-2 lg:hidden">
            {SESSION_STEPS.map((s, i) => (
              <li key={s.key} className={`h-1.5 rounded-full transition-all duration-300 ${i === idx ? 'w-8 bg-[var(--color-gold)]' : i < idx ? 'w-3 bg-[var(--color-gold)]/50' : 'w-3 bg-[var(--color-line)]'}`} />
            ))}
          </ol>

          <AnimatePresence mode="wait">
            <motion.section key={step} {...fade} className={`mx-auto max-w-2xl ${presenting && clientSafe ? 'text-lg' : ''}`}>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-gold)]">{def.kicker}</p>
              <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl leading-tight sm:text-5xl">
                {def.title.replace('{name}', p.client.firstName)}
              </h1>

              {err && <p role="alert" aria-live="assertive" className="mt-6 rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-4 py-3 text-sm">{err}</p>}

              <div className="mt-8 space-y-6">
                {step === 'arrival' && <ArrivalStep p={p} presenting={presenting} onBegin={() => goTo('safety')} />}
                {step === 'safety' && (
                  <SafetyStep
                    p={p} live={live} pending={pending} presenting={presenting}
                    onReviewFlag={() => run(() => reviewMedicalFlag(p.booking.id))}
                    onSaveSop={(items, all) => run(() => saveSopChecklist(p.booking.id, items, all))}
                    onContinue={() => goTo('consent')}
                  />
                )}
                {step === 'consent' && (
                  <ConsentStep p={p} live={live} baseUrl={p.baseUrl} onContinue={() => goTo('treatment')} onSkip={() => goTo('treatment', { skip: true })} onRefresh={refreshStatus} />
                )}
                {step === 'treatment' && (
                  <TreatmentStep
                    p={p} live={live} pending={pending} presenting={presenting} canStart={canStart}
                    gateHints={{ flagOk, sopOk, consentOk, photoOk }}
                    elapsed={treatmentElapsed} api={api}
                    onStart={() => run(() => startAppointment(p.booking.id))}
                    onSaveNote={(note) => run(() => saveClinicalNote(p.booking.id, note))}
                    onContinue={() => goTo('aftercare')}
                  />
                )}
                {step === 'aftercare' && (
                  <AftercareStep p={p} live={live} api={api} onConfirmed={refreshStatus} onContinue={() => goTo('wrap')} />
                )}
                {step === 'wrap' && (
                  <WrapStep
                    p={p} live={live} pending={pending} timings={timings} stepSeconds={stepSeconds} sessionDone={sessionDone}
                    onFinish={() => startTransition(async () => {
                      setErr('');
                      const r = await finishAppointment(p.booking.id);
                      if (!r.ok) { setErr(r.error || 'Could not finish.'); return; }
                      await api({ op: 'complete' });
                      setSessionDone(true);
                      setTimings((t) => closeTimings(t));
                      await refreshStatus();
                    })}
                  />
                )}
              </div>

              {/* Back link (kept subtle; rail and dots are primary) */}
              {idx > 0 && step !== 'wrap' && !presenting && (
                <button type="button" onClick={() => goTo(SESSION_STEPS[idx - 1].key)} className="mt-10 text-sm text-[var(--color-stone)] transition-colors hover:text-[var(--color-ink)]">
                  ← {SESSION_STEPS[idx - 1].label}
                </button>
              )}
            </motion.section>
          </AnimatePresence>
        </div>
      </div>

      {presenting && (
        <button
          type="button"
          onClick={() => setPresenting(false)}
          className="fixed bottom-5 right-5 z-30 rounded-full border border-[var(--color-line)] bg-[var(--color-porcelain)]/95 px-4 py-2.5 text-xs text-[var(--color-stone)] shadow-[var(--shadow-soft)] backdrop-blur transition-colors hover:text-[var(--color-ink)]"
        >
          End presentation (Esc)
        </button>
      )}
    </div>
  );
}

/* ── Steps ──────────────────────────────────────────────────────────────── */

function ArrivalStep({ p, presenting, onBegin }: { p: Props; presenting: boolean; onBegin: () => void }) {
  const when = new Date(p.booking.startAt);
  return (
    <>
      <p className="max-w-prose leading-relaxed text-[var(--color-stone)]">
        {p.booking.treatmentTitle}
        {p.booking.addOns.length > 0 && <> with {p.booking.addOns.join(', ')}</>} ·{' '}
        {when.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} at {fmtTime(p.booking.startAt)} · about {p.booking.durationMin} minutes
        {p.practitionerName && <> with {p.practitionerName}</>}.
      </p>

      {p.booking.refreshments.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-6">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]">While you settle in</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {p.booking.refreshments.map((r) => (
              <span key={r} className="rounded-full bg-[var(--color-porcelain)] px-3.5 py-1.5 text-sm">{r}</span>
            ))}
          </div>
        </div>
      )}

      {!presenting && (p.client.medicalFlag || p.client.allergyNote) && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-blush)] bg-[var(--color-blush)]/10 p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]">Staff only — hidden while presenting</p>
          {p.client.medicalFlag && <p className="mt-2 text-sm"><strong>Medical flag:</strong> {p.client.medicalFlag}</p>}
          {p.client.allergyNote && <p className="mt-1 text-sm"><strong>Allergies:</strong> {p.client.allergyNote}</p>}
        </div>
      )}

      <button type="button" onClick={onBegin} className="mt-2 inline-flex min-h-12 items-center gap-3 rounded-full bg-[var(--color-gold)] px-8 py-3.5 text-base font-medium text-white transition-all hover:bg-[var(--color-ink)]">
        Begin <ArrowIcon />
      </button>
    </>
  );
}

function SafetyStep({ p, live, pending, presenting, onReviewFlag, onSaveSop, onContinue }: {
  p: Props; live: { medicalFlagReviewedAt: string | null; sopAcknowledgedAt: string | null }; pending: boolean; presenting: boolean;
  onReviewFlag: () => void; onSaveSop: (items: SopItem[], all: boolean) => void; onContinue: () => void;
}) {
  const [items, setItems] = useState<SopItem[]>(() =>
    p.sop.steps.map((s, i) => ({ step: s.step, checked: p.sop.saved?.[i]?.checked ?? false, response: p.sop.saved?.[i]?.response ?? '' })));
  const allChecked = items.length > 0 && items.every((i) => i.checked);
  const flagDone = !p.client.medicalFlag || !!live.medicalFlagReviewedAt;
  const sopDone = !!live.sopAcknowledgedAt;

  if (presenting) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 text-center">
        <p className="text-[var(--color-stone)]">A quick clinical check on our side — one moment.</p>
      </div>
    );
  }

  return (
    <>
      <p className="max-w-prose text-sm leading-relaxed text-[var(--color-stone)]">
        Staff step — confirm the clinical context before the chair. This screen stays private; switch to Present after.
      </p>

      {p.client.medicalFlag && (
        <div className={`rounded-[var(--radius-lg)] border p-5 ${flagDone ? 'border-[var(--color-line)] bg-[var(--color-bone)]' : 'border-[var(--color-blush)] bg-[var(--color-blush)]/10'}`}>
          <p className="text-sm font-semibold">Medical flag</p>
          <p className="mt-1 text-sm text-[var(--color-stone)]">{p.client.medicalFlag}</p>
          {flagDone
            ? <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-[var(--color-gold)]"><CheckIcon /> Reviewed</p>
            : <button type="button" disabled={pending} onClick={onReviewFlag} className="mt-3 min-h-11 rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm text-[var(--color-porcelain)] disabled:opacity-50">I’ve reviewed this flag</button>}
        </div>
      )}

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">{p.sop.title}</p>
          <span className={`text-xs tabular-nums ${allChecked ? 'text-[var(--color-gold)]' : 'text-[var(--color-stone)]'}`}>{items.filter((i) => i.checked).length}/{items.length}</span>
        </div>
        <ul className="mt-4 space-y-3">
          {p.sop.steps.map((s, i) => (
            <li key={i}>
              <label className="flex min-h-11 cursor-pointer items-start gap-3">
                <input type="checkbox" checked={items[i]?.checked ?? false}
                  onChange={() => setItems((arr) => arr.map((x, j) => (j === i ? { ...x, checked: !x.checked } : x)))}
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-gold)]" />
                <span className={`text-sm leading-relaxed ${items[i]?.checked ? 'text-[var(--color-stone)]' : ''}`}>{s.step}</span>
              </label>
              {s.capture && (
                <input
                  value={items[i]?.response ?? ''}
                  onChange={(e) => setItems((arr) => arr.map((x, j) => (j === i ? { ...x, response: e.target.value } : x)))}
                  placeholder="Client’s response…"
                  aria-label={`Response for: ${s.step}`}
                  className="ml-7 mt-1.5 w-[calc(100%-1.75rem)] rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-gold)]"
                />
              )}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center gap-3">
          <button type="button" disabled={pending} onClick={() => onSaveSop(items, allChecked)} className="min-h-11 rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm text-[var(--color-porcelain)] disabled:opacity-50">
            {allChecked ? 'Complete checklist' : 'Save progress'}
          </button>
          {sopDone && <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-gold)]"><CheckIcon /> Acknowledged</span>}
        </div>
      </div>

      <ContinueButton onClick={onContinue} label="Continue to consent" />
    </>
  );
}

function ConsentStep({ p, live, baseUrl, onContinue, onSkip, onRefresh }: {
  p: Props; live: { consentSigned: boolean; consents: { kind: string; title: string; signedAt: string; cert: string }[] };
  baseUrl: string; onContinue: () => void; onSkip: () => void; onRefresh: () => void;
}) {
  const [link, setLink] = useState(p.consent.pendingToken ? `${baseUrl}/sign/${p.consent.pendingToken}` : '');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const treatmentConsents = live.consents.filter((c) => c.kind === 'treatment');

  async function createRequest() {
    if (!p.consent.templateKey) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/consent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'createRequest', clientId: p.clientId, bookingId: p.booking.id, templateKey: p.consent.templateKey, kind: 'treatment' }),
      });
      const j = await res.json().catch(() => ({ ok: false }));
      if (j.ok && j.url) setLink(j.url);
    } finally { setBusy(false); }
  }

  if (live.consentSigned) {
    const c = treatmentConsents[0];
    return (
      <>
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-gold)]/40 bg-[var(--color-bone)] p-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--color-gold)] text-white" aria-hidden><CheckIcon large /></span>
          <p className="mt-4 font-[family-name:var(--font-display)] text-2xl">Consent on record</p>
          {c && (
            <p className="mt-2 text-sm text-[var(--color-stone)]">
              {c.title} — signed {new Date(c.signedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              <span className="mt-1 block font-[family-name:var(--font-mono)] text-xs">certificate {c.cert}</span>
            </p>
          )}
        </div>
        <ContinueButton onClick={onContinue} label="Continue to treatment" />
      </>
    );
  }

  return (
    <>
      <p className="max-w-prose leading-relaxed text-[var(--color-stone)]">
        Before we begin, please read and sign the treatment consent. It opens as a private signing screen — read each point, tick to agree, and sign with your finger.
      </p>

      {link ? (
        <div className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-6">
          <a href={link} target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center gap-3 rounded-full bg-[var(--color-gold)] px-8 py-3.5 text-base font-medium text-white transition-colors hover:bg-[var(--color-ink)]">
            Open the signing screen <ArrowIcon />
          </a>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <button type="button" className="min-h-11 rounded-full border border-[var(--color-line)] px-4 py-2 text-[var(--color-stone)] transition-colors hover:text-[var(--color-ink)]"
              onClick={() => { navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}>
              {copied ? 'Copied' : 'Copy link for the client’s phone'}
            </button>
            <button type="button" onClick={onRefresh} className="min-h-11 rounded-full border border-[var(--color-line)] px-4 py-2 text-[var(--color-stone)] transition-colors hover:text-[var(--color-ink)]">
              I’ve signed — check now
            </button>
          </div>
          <p className="text-xs text-[var(--color-stone)]" role="status" aria-live="polite">Watching for the signature — the certificate appears here the moment it’s signed.</p>
        </div>
      ) : p.consent.templateKey ? (
        <button type="button" disabled={busy} onClick={createRequest}
          className="inline-flex min-h-12 items-center gap-3 rounded-full bg-[var(--color-gold)] px-8 py-3.5 text-base font-medium text-white transition-colors hover:bg-[var(--color-ink)] disabled:opacity-50">
          {busy ? 'Preparing…' : <>Prepare the consent form <ArrowIcon /></>}
        </button>
      ) : (
        <p className="rounded-[var(--radius-sm)] bg-[var(--color-bone)] px-4 py-3 text-sm text-[var(--color-stone)]">No consent template is mapped to this treatment yet — manage templates under Admin → Consent.</p>
      )}

      {!p.consent.required && (
        <button type="button" onClick={onSkip} className="block text-sm text-[var(--color-stone)] underline-offset-4 transition-colors hover:text-[var(--color-ink)] hover:underline">
          Skip for now (not required by policy)
        </button>
      )}
    </>
  );
}

function TreatmentStep({ p, live, pending, presenting, canStart, gateHints, elapsed, api, onStart, onSaveNote, onContinue }: {
  p: Props; live: { startedAt: string | null; finishedAt: string | null }; pending: boolean; presenting: boolean; canStart: boolean;
  gateHints: { flagOk: boolean; sopOk: boolean; consentOk: boolean; photoOk: boolean };
  elapsed: number; api: (payload: Record<string, unknown>) => Promise<{ ok: boolean }>;
  onStart: () => void; onSaveNote: (note: string) => void; onContinue: () => void;
}) {
  const [note, setNote] = useState(p.clinicalNote);
  const [comfort, setComfort] = useState(p.existingSession?.data?.comfort_note?.value ?? '');
  const [savedMsg, setSavedMsg] = useState('');
  const started = !!live.startedAt;

  const gateList = [
    { ok: gateHints.flagOk, label: 'Medical flag reviewed' },
    { ok: gateHints.sopOk, label: 'SOP acknowledged' },
    { ok: gateHints.consentOk, label: 'Consent signed' },
    ...(p.gates.requireBeforePhoto ? [{ ok: gateHints.photoOk, label: 'Before photo (or signed opt-out)' }] : []),
  ];

  return (
    <>
      {!started ? (
        <>
          <p className="max-w-prose leading-relaxed text-[var(--color-stone)]">Everything checked — start the clock as the treatment begins.</p>
          {!canStart && !presenting && (
            <ul className="space-y-2 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-5 text-sm">
              {gateList.map((g) => (
                <li key={g.label} className={`flex items-center gap-2.5 ${g.ok ? 'text-[var(--color-stone)]' : ''}`}>
                  <span aria-hidden className={`grid h-5 w-5 place-items-center rounded-full ${g.ok ? 'bg-[var(--color-gold)] text-white' : 'border border-[var(--color-blush)] text-[var(--color-blush)]'}`}>{g.ok ? <CheckIcon /> : '·'}</span>
                  {g.label}
                </li>
              ))}
            </ul>
          )}
          <button type="button" disabled={pending || !canStart} onClick={onStart}
            className="inline-flex min-h-12 items-center gap-3 rounded-full bg-[var(--color-gold)] px-8 py-3.5 text-base font-medium text-white transition-colors hover:bg-[var(--color-ink)] disabled:opacity-40">
            Start treatment <ArrowIcon />
          </button>
        </>
      ) : (
        <>
          <div className="rounded-[var(--radius-lg)] bg-[var(--color-ink)] p-8 text-center text-[var(--color-porcelain)]">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-gold-bright)]">{live.finishedAt ? 'Treatment complete' : 'In treatment'}</p>
            <p className="mt-3 font-[family-name:var(--font-display)] text-6xl tabular-nums">{fmtClock(elapsed)}</p>
            <p className="mt-2 text-sm text-[color-mix(in_oklab,var(--color-porcelain)_65%,transparent)]">booked {p.booking.durationMin} min</p>
          </div>

          {!presenting && (
            <>
              <div>
                <label htmlFor="session-comfort" className="mb-1.5 block text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]">Comfort & preferences (front-of-house note)</label>
                <input id="session-comfort" value={comfort} onChange={(e) => setComfort(e.target.value)}
                  onBlur={() => { if (comfort.trim()) { api({ op: 'save', field: 'comfort_note', value: comfort.trim() }).then(() => { setSavedMsg('Saved'); setTimeout(() => setSavedMsg(''), 1500); }); } }}
                  placeholder="e.g. prefers the room cooler, music low…"
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--color-gold)]" />
                <p className="mt-1 text-xs text-[var(--color-stone)]" role="status" aria-live="polite">{savedMsg || 'Edits after first save are audit-logged.'}</p>
              </div>

              {p.canClinical && (
                <div>
                  <label htmlFor="session-clinical" className="mb-1.5 block text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]">Clinical treatment note (encrypted)</label>
                  <textarea id="session-clinical" rows={4} value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder="Settings, areas treated, observations…"
                    className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--color-gold)]" />
                  <button type="button" disabled={pending} onClick={() => onSaveNote(note)} className="mt-2 min-h-11 rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm text-[var(--color-porcelain)] disabled:opacity-50">Save note</button>
                </div>
              )}
            </>
          )}

          <ContinueButton onClick={onContinue} label="Continue to aftercare" />
        </>
      )}
    </>
  );
}

function AftercareStep({ p, live, api, onConfirmed, onContinue }: {
  p: Props; live: { aftercareAckAt: string | null };
  api: (payload: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
  onConfirmed: () => void; onContinue: () => void;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const confirmedBy = p.existingSession?.data?.aftercare_confirmed_by?.value;
  const confirmed = !!confirmedBy || !!live.aftercareAckAt;

  async function confirm() {
    if (!name.trim()) { setError('Please type your name to confirm.'); return; }
    setBusy(true); setError('');
    const r = await api({ op: 'aftercare', confirmedBy: name.trim() });
    setBusy(false);
    if (!r.ok) { setError(r.error || 'Could not save — please try again.'); return; }
    onConfirmed();
    onContinue();
  }

  return (
    <>
      <p className="max-w-prose leading-relaxed text-[var(--color-stone)]">{p.aftercare.intro}</p>

      <ul className="space-y-3">
        {p.aftercare.items.map((item, i) => (
          <li key={i} className="flex items-start gap-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-4">
            <span aria-hidden className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-porcelain)] text-[var(--color-gold)]"><AftercareIcon name={item.icon} /></span>
            <span className="text-sm leading-relaxed sm:text-base">{item.text}</span>
          </li>
        ))}
      </ul>

      {confirmed ? (
        <>
          <p className="inline-flex items-center gap-2 rounded-full bg-[var(--color-bone)] px-4 py-2.5 text-sm text-[var(--color-stone)]">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--color-gold)] text-white" aria-hidden><CheckIcon /></span>
            Aftercare confirmed{confirmedBy ? ` by ${confirmedBy}` : ''}
          </p>
          <ContinueButton onClick={onContinue} label="Continue to wrap-up" />
        </>
      ) : (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
          <label htmlFor="aftercare-name" className="mb-1.5 block text-sm">I’ve read and understood my aftercare — type your name to confirm:</label>
          <div className="flex flex-wrap gap-3">
            <input id="aftercare-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off"
              placeholder={p.client.firstName}
              className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-4 py-3 outline-none transition-colors focus:border-[var(--color-gold)]" />
            <button type="button" disabled={busy} onClick={confirm}
              className="min-h-12 rounded-full bg-[var(--color-gold)] px-7 py-3 font-medium text-white transition-colors hover:bg-[var(--color-ink)] disabled:opacity-50">
              {busy ? 'Saving…' : 'Confirm'}
            </button>
          </div>
          {error && <p role="alert" className="mt-2 text-sm text-[var(--color-blush)]">{error}</p>}
        </div>
      )}
    </>
  );
}

function WrapStep({ p, live, pending, timings, stepSeconds, sessionDone, onFinish }: {
  p: Props; live: { startedAt: string | null; finishedAt: string | null; actualMinutes: number | null };
  pending: boolean; timings: StepTimings; stepSeconds: (k: SessionStepKey) => number; sessionDone: boolean; onFinish: () => void;
}) {
  const finished = !!live.finishedAt;
  const total = SESSION_STEPS.reduce((s, st) => s + stepSeconds(st.key), 0);

  return (
    <>
      {!finished ? (
        <>
          <p className="max-w-prose leading-relaxed text-[var(--color-stone)]">
            Finish to stop the clock — this completes the appointment, credits {p.client.firstName}’s Beauty Points and sends the review invitation.
          </p>
          <button type="button" disabled={pending || !live.startedAt} onClick={onFinish}
            className="inline-flex min-h-12 items-center gap-3 rounded-full bg-[var(--color-gold)] px-8 py-3.5 text-base font-medium text-white transition-colors hover:bg-[var(--color-ink)] disabled:opacity-40">
            Finish & complete <ArrowIcon />
          </button>
          {!live.startedAt && <p className="text-sm text-[var(--color-stone)]">The treatment hasn’t been started — go back to the Treatment step first.</p>}
        </>
      ) : (
        <>
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-gold)]/40 bg-[var(--color-bone)] p-8 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--color-gold)] text-white" aria-hidden><CheckIcon large /></span>
            <p className="mt-4 font-[family-name:var(--font-display)] text-3xl">Thank you, {p.client.firstName}.</p>
            <p className="mt-2 text-[var(--color-stone)]">
              Completed in {live.actualMinutes ?? '—'} min (booked {p.booking.durationMin}). Your aftercare guide and Beauty Points are on your account.
            </p>
          </div>

          {sessionDone && total > 0 && (
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]">Session timing</p>
              <ul className="mt-4 space-y-3">
                {SESSION_STEPS.map((s) => {
                  const secs = stepSeconds(s.key);
                  const pct = total ? Math.max(2, Math.round((secs / total) * 100)) : 0;
                  return (
                    <li key={s.key} className="flex items-center gap-3 text-sm">
                      <span className="w-24 shrink-0 text-[var(--color-stone)]">{s.label}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-bone)]">
                        <span className="block h-full rounded-full bg-[var(--color-gold)]" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="w-24 shrink-0 text-right tabular-nums text-[var(--color-stone)]">
                        {fmtClock(secs)}{timings[s.key]?.skipped ? ' · skipped' : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <Link href={`/admin/bookings/${p.booking.id}`}
            className="inline-flex min-h-12 items-center gap-3 rounded-full bg-[var(--color-ink)] px-8 py-3.5 text-base font-medium text-[var(--color-porcelain)] transition-colors hover:bg-[var(--color-gold)]">
            Back to the booking (payment & notes) <ArrowIcon />
          </Link>
        </>
      )}
    </>
  );
}

/* ── Small pieces ───────────────────────────────────────────────────────── */

function ContinueButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick}
      className="inline-flex min-h-12 items-center gap-3 rounded-full border border-[var(--color-ink)] px-8 py-3.5 text-base font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-ink)] hover:text-[var(--color-porcelain)]">
      {label} <ArrowIcon />
    </button>
  );
}

function ArrowIcon() {
  return <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8h11m0 0L9 4m4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function CheckIcon({ large = false }: { large?: boolean }) {
  const s = large ? 22 : 12;
  return <svg aria-hidden width={s} height={s} viewBox="0 0 12 12" fill="none"><path d="M2 6.2 4.8 9 10 3.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function AftercareIcon({ name }: { name: string }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  switch (name) {
    case 'sun': return <svg {...common}><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
    case 'water': return <svg {...common}><path d="M12 3s6 6.5 6 11a6 6 0 1 1-12 0c0-4.5 6-11 6-11Z" /></svg>;
    case 'no-touch': return <svg {...common}><path d="M8 11V5.5a1.5 1.5 0 0 1 3 0V11m0-3.5a1.5 1.5 0 0 1 3 0V11m0-2a1.5 1.5 0 0 1 3 0v5a6 6 0 0 1-10.6 3.9L4 14.5a1.6 1.6 0 0 1 2.3-2.2L8 14" /><path d="M3 3l18 18" /></svg>;
    case 'cool': return <svg {...common}><path d="M12 2v20M4 7l16 10M20 7 4 17M9 4l3 2 3-2M9 20l3-2 3 2" /></svg>;
    case 'rest': return <svg {...common}><path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10Z" /></svg>;
    case 'clock': return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case 'sparkle': return <svg {...common}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16Z" /></svg>;
    default: return <svg {...common}><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>;
  }
}
