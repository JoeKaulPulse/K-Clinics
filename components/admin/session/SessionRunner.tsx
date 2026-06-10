'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { SESSION_STEPS, type SessionStepKey, type StepTimings } from '@/lib/appointment-session';
import type { SessionSnapshot } from '@/lib/appointment-session-server';
import { reviewMedicalFlag, saveSopChecklist, startAppointment, finishAppointment, saveClinicalNote } from '@/app/admin/bookings/clinical-actions';
import { useSessionChannel } from '@/components/admin/session/useSessionChannel';

// BLD-138 v2 — the realtime appointment session runner. Every open device
// (front desk, host, clinician, checkout) follows the same session over SSE:
// step changes, handoffs, payments and the rebook land everywhere instantly,
// no refreshes. "Present" turns any screen client-safe. The client follows
// along on their phone via the QR'd live link.

type SopItem = { step: string; checked: boolean; response?: string };
type Product = { id: string; name: string; pricePence: number; stockQty: number; trackInventory: boolean; ageRestricted: boolean; soldOut: boolean };

type Props = {
  me: { email: string; name: string; title: string | null; photo: string | null };
  canCharge: boolean;
  canPos: boolean;
  canClinical: boolean;
  baseUrl: string;
  liveUrl: string;
  liveQrSvg: string;
  products: Product[];
  nextRec: { dateISO: string; label: string; maintenance: boolean } | null;
  booking: {
    id: string; treatmentSlug: string; treatmentTitle: string; startAt: string; durationMin: number; pricePence: number;
    refreshments: string[]; addOns: string[];
  };
  client: { id: string; firstName: string; fullName: string; email: string; medicalFlag: string | null; allergyNote: string | null };
  practitionerName: string | null;
  sop: { title: string; steps: { step: string; capture: boolean }[]; saved: SopItem[] | null };
  consent: { required: boolean; templateKey: string | null; pendingToken: string | null };
  gates: { requireSop: boolean; requireMedical: boolean; requireBeforePhoto: boolean; isLaser: boolean };
  clinicalNote: string;
  aftercare: { title: string; intro: string; items: { icon: string; text: string }[] };
  initialSnapshot: SessionSnapshot | null;
};

const fmtClock = (totalSeconds: number) => {
  const m = Math.floor(totalSeconds / 60); const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const money = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}`;

export function SessionRunner(p: Props) {
  const reduce = useReducedMotion();
  const { snapshot: liveSnap } = useSessionChannel(p.booking.id);
  const snap = liveSnap ?? p.initialSnapshot;
  const sess = snap?.session ?? null;
  const sessionDone = sess?.status === 'COMPLETED';

  const serverStep: SessionStepKey = (sess && SESSION_STEPS.some((s) => s.key === sess.currentStep)
    ? sess.currentStep : 'arrival') as SessionStepKey;
  // The server is authoritative; an expiring optimistic overlay makes local
  // taps feel instant without ever stranding a device on an unconfirmed step.
  const [optimistic, setOptimistic] = useState<{ step: SessionStepKey; until: number } | null>(null);
  // Browsing a completed session is local-only (the server step is frozen).
  const [browse, setBrowse] = useState<SessionStepKey | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [err, setErr] = useState('');
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const startAttempts = useRef(0);
  const enterChain = useRef<Promise<unknown>>(Promise.resolve());

  const step: SessionStepKey = sessionDone
    ? (browse ?? serverStep)
    : (optimistic && optimistic.until > now && optimistic.step !== serverStep ? optimistic.step : serverStep);

  // Clear the overlay once the server confirms it.
  useEffect(() => {
    if (optimistic && serverStep === optimistic.step) setOptimistic(null);
  }, [serverStep, optimistic]);

  const api = useCallback(async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/admin/bookings/session', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: p.booking.id, ...payload }),
    });
    return res.json().catch(() => ({ ok: false, error: 'Network error.' }));
  }, [p.booking.id]);

  // Create/resume the session on first open (front-desk check-in moment).
  // Retries on transient failure — otherwise the whole visit would silently
  // run without timings, touchpoints or the client's live page.
  useEffect(() => {
    if (sess || startAttempts.current >= 5) return;
    let cancelled = false;
    const attempt = () => {
      startAttempts.current += 1;
      api({ op: 'start' }).then((r) => {
        if (cancelled || r?.ok) return;
        if (startAttempts.current >= 5) setErr('Could not start the live session — check the connection and reload.');
      }).catch(() => { /* retried below */ });
    };
    attempt();
    const id = setInterval(() => { if (!sess && startAttempts.current < 5) attempt(); else clearInterval(id); }, 4000);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sess]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPresenting(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const goTo = useCallback((next: SessionStepKey, opts: { skip?: boolean } = {}) => {
    setErr('');
    if (sessionDone) { setBrowse(next); return; }
    const from = step;
    setOptimistic({ step: next, until: Date.now() + 5000 });
    // Serialised: rapid taps land in order, and failures are surfaced instead
    // of leaving this device on a step the rest of the clinic never sees.
    enterChain.current = enterChain.current
      .then(() => api({ op: 'enter', step: next, ...(opts.skip ? { skippedFrom: from } : {}) }))
      .then((r) => { if (!(r as { ok?: boolean })?.ok) setErr((r as { error?: string })?.error || 'Step change didn’t reach the server — it will snap back.'); })
      .catch(() => setErr('Network hiccup — the step change didn’t save.'));
  }, [api, step, sessionDone]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setErr('');
      const r = await fn();
      if (!r.ok) setErr(r.error || 'That didn’t work — please try again.');
    });

  // ── Derived live state ──────────────────────────────────────────────────
  const timings: StepTimings = sess?.steps ?? {};
  const stepSeconds = (k: SessionStepKey) => {
    const t = timings[k];
    if (!t) return 0;
    const open = t.enteredAt ? Math.max(0, Math.round((now - new Date(t.enteredAt).getTime()) / 1000)) : 0;
    return t.seconds + open;
  };
  const live = {
    startedAt: snap?.booking.startedAt ?? null,
    finishedAt: snap?.booking.finishedAt ?? null,
    actualMinutes: snap?.booking.actualMinutes ?? null,
    aftercareAckAt: snap?.booking.aftercareAckAt ?? null,
    sopAcknowledgedAt: snap?.booking.sopAcknowledgedAt ?? null,
    medicalFlagReviewedAt: snap?.booking.medicalFlagReviewedAt ?? null,
    chargedPence: snap?.booking.chargedPence ?? null,
    chargedAt: snap?.booking.chargedAt ?? null,
    consentSigned: snap?.consentSigned ?? false,
    consents: snap?.consents ?? [],
    hasBeforePhoto: snap?.hasBeforePhoto ?? false,
  };
  const treatmentElapsed = live.startedAt
    ? (live.finishedAt
        ? Math.max(0, Math.round((new Date(live.finishedAt).getTime() - new Date(live.startedAt).getTime()) / 1000))
        : Math.max(0, Math.floor((now - new Date(live.startedAt).getTime()) / 1000)))
    : 0;

  const active = sess?.activeStaff ?? null;
  const isMine = active?.email === p.me.email;

  const idx = SESSION_STEPS.findIndex((s) => s.key === step);
  const def = SESSION_STEPS[idx];
  const clientSafe = def.clientFacing;

  const flagOk = !p.client.medicalFlag || !p.gates.requireMedical || !!live.medicalFlagReviewedAt;
  const sopOk = !p.gates.requireSop || !!live.sopAcknowledgedAt;
  const consentOk = !p.consent.required || live.consentSigned;
  const photoOk = !p.gates.requireBeforePhoto || live.hasBeforePhoto;
  const canStart = flagOk && sopOk && consentOk && photoOk;

  const fade = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } }
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.26, ease: [0.16, 1, 0.3, 1] as const } };

  return (
    <div>
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-[var(--color-line)] bg-[var(--color-porcelain)]/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          {presenting ? <span aria-hidden className="w-16" /> : (
            <Link href={`/admin/bookings/${p.booking.id}`} className="shrink-0 rounded-full px-3 py-2 text-sm text-[var(--color-stone)] transition-colors hover:text-[var(--color-ink)]">
              ← Booking
            </Link>
          )}

          {/* Presence — who is with the client right now, live on every device */}
          <div className="flex min-w-0 items-center gap-2">
            {active && (
              <span className="flex min-w-0 items-center gap-2 rounded-full bg-[var(--color-bone)] py-1 pl-1 pr-3 text-xs">
                <Avatar name={active.name} photo={active.photo} size={26} />
                <span className="truncate">
                  <span className="font-medium">{isMine ? 'You' : active.name}</span>
                  {!presenting && <span className="text-[var(--color-stone)]"> · {SESSION_STEPS.find((s) => s.key === serverStep)?.label}</span>}
                </span>
              </span>
            )}
            {active && !isMine && !presenting && !sessionDone && (
              <button type="button" disabled={pending} onClick={() => run(() => api({ op: 'claim' }))}
                className="shrink-0 rounded-full border border-[var(--color-gold)] px-3 py-1.5 text-xs font-medium text-[var(--color-gold)] transition-colors hover:bg-[var(--color-gold)] hover:text-white disabled:opacity-50">
                Take over
              </button>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {live.startedAt && !live.finishedAt && (
              <span className="hidden items-center gap-2 rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs text-[var(--color-porcelain)] sm:flex">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-gold-bright)]" aria-hidden />
                <span className="tabular-nums">{fmtClock(treatmentElapsed)}</span>
              </span>
            )}
            <button
              type="button" onClick={() => setPresenting((v) => !v)} aria-pressed={presenting}
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
                    type="button" onClick={() => goTo(s.key)}
                    aria-current={state === 'current' ? 'step' : undefined}
                    className={`group flex w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-left transition-colors ${state === 'current' ? 'bg-[var(--color-bone)]' : 'hover:bg-[var(--color-bone)]/60'}`}
                  >
                    <span aria-hidden className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[10px] transition-colors ${
                      state === 'done' ? 'border-[var(--color-gold)] bg-[var(--color-gold)] text-white'
                      : state === 'current' ? 'border-[var(--color-gold)] text-[var(--color-gold)]'
                      : 'border-[var(--color-line)] text-[var(--color-stone)]'}`}>
                      {state === 'done' ? <CheckIcon /> : i + 1}
                    </span>
                    <span className={`min-w-0 flex-1 text-sm ${state === 'current' ? 'font-medium text-[var(--color-ink)]' : 'text-[var(--color-stone)]'}`}>{s.label}</span>
                    {!presenting && secs > 0 && <span className="text-[11px] tabular-nums text-[var(--color-stone)]">{fmtClock(secs)}</span>}
                  </button>
                </li>
              );
            })}
          </ol>
          {!presenting && (
            <p className="mt-4 px-3 text-[11px] leading-relaxed text-[var(--color-stone-soft)]">
              Live on every device — hand the client to the next team member and their screen is already on the right step.
            </p>
          )}
        </nav>

        {/* ── Step content ───────────────────────────────────────────────── */}
        <div className="min-w-0 flex-1">
          <ol aria-hidden className="mb-8 flex items-center justify-center gap-1.5 lg:hidden">
            {SESSION_STEPS.map((s, i) => (
              <li key={s.key} className={`h-1.5 rounded-full transition-all duration-300 ${i === idx ? 'w-7 bg-[var(--color-gold)]' : i < idx ? 'w-2.5 bg-[var(--color-gold)]/50' : 'w-2.5 bg-[var(--color-line)]'}`} />
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
                  <ConsentStep p={p} live={live} onContinue={() => goTo('treatment')} onSkip={() => goTo('treatment', { skip: true })} />
                )}
                {step === 'treatment' && (
                  <TreatmentStep
                    p={p} live={live} sessData={sess?.data ?? {}} pending={pending} presenting={presenting} canStart={canStart}
                    gateHints={{ flagOk, sopOk, consentOk, photoOk }}
                    elapsed={treatmentElapsed} api={api}
                    onStart={() => run(() => startAppointment(p.booking.id))}
                    onFinish={() => run(() => finishAppointment(p.booking.id))}
                    onSaveNote={(note) => run(() => saveClinicalNote(p.booking.id, note))}
                    onContinue={() => goTo('aftercare')}
                  />
                )}
                {step === 'aftercare' && (
                  <AftercareStep p={p} live={live} sessData={sess?.data ?? {}} api={api} onContinue={() => goTo('checkout')} />
                )}
                {step === 'checkout' && (
                  <CheckoutStep p={p} live={live} sessData={sess?.data ?? {}} pending={pending} presenting={presenting} api={api} run={run} onContinue={() => goTo('nextvisit')} />
                )}
                {step === 'nextvisit' && (
                  <NextVisitStep p={p} sessData={sess?.data ?? {}} api={api} onContinue={() => goTo('farewell')} onSkip={() => goTo('farewell', { skip: true })} />
                )}
                {step === 'farewell' && (
                  <FarewellStep p={p} live={live} pending={pending} sessionDone={sessionDone} timings={timings} stepSeconds={stepSeconds}
                    onComplete={() => run(() => api({ op: 'complete' }))} />
                )}
              </div>

              {idx > 0 && step !== 'farewell' && !presenting && (
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
          type="button" onClick={() => setPresenting(false)}
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
  const [copied, setCopied] = useState(false);
  return (
    <>
      <p className="max-w-prose leading-relaxed text-[var(--color-stone)]">
        {p.booking.treatmentTitle}
        {p.booking.addOns.length > 0 && <> with {p.booking.addOns.join(', ')}</>} ·{' '}
        {when.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} at {fmtTime(p.booking.startAt)} · about {p.booking.durationMin} minutes
        {p.practitionerName && <> with {p.practitionerName}</>}.
      </p>

      {/* Live phone companion — scan to follow the visit step by step */}
      {p.liveQrSvg && (
        <div className="flex flex-col items-start gap-6 rounded-[var(--radius-lg)] border border-[var(--color-gold)]/40 bg-[var(--color-bone)] p-6 sm:flex-row sm:items-center">
          <span className="block h-28 w-28 shrink-0 overflow-hidden rounded-[var(--radius-sm)] [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: p.liveQrSvg }} aria-label="QR code for your live visit companion" role="img" />
          <div>
            <p className="font-[family-name:var(--font-display)] text-xl">Follow along on your phone</p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--color-stone)]">
              Scan to open your live visit companion — see each stage as it happens and who&rsquo;s looking after you, moment to moment.
            </p>
            {!presenting && (
              <button type="button" className="mt-3 min-h-11 rounded-full border border-[var(--color-line)] px-4 py-2 text-xs text-[var(--color-stone)] transition-colors hover:text-[var(--color-ink)]"
                onClick={() => { navigator.clipboard?.writeText(p.liveUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}>
                {copied ? 'Link copied' : 'Copy link instead'}
              </button>
            )}
          </div>
        </div>
      )}

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

function ConsentStep({ p, live, onContinue, onSkip }: {
  p: Props; live: { consentSigned: boolean; consents: { kind: string; title: string; signedAt: string; cert: string }[] };
  onContinue: () => void; onSkip: () => void;
}) {
  // Always the canonical host — a link copied to the client's phone must work
  // even when staff drive the session from a preview/internal hostname.
  const [link, setLink] = useState(p.consent.pendingToken ? `${p.baseUrl}/sign/${p.consent.pendingToken}` : '');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const treatmentConsents = live.consents.filter((c) => c.kind === 'treatment');

  async function createRequest() {
    if (!p.consent.templateKey) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/consent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'createRequest', clientId: p.client.id, bookingId: p.booking.id, templateKey: p.consent.templateKey, kind: 'treatment' }),
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
          </div>
          <p className="text-xs text-[var(--color-stone)]" role="status" aria-live="polite">Watching for the signature — the certificate appears here the moment it’s signed, on every screen.</p>
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

function TreatmentStep({ p, live, sessData, pending, presenting, canStart, gateHints, elapsed, api, onStart, onFinish, onSaveNote, onContinue }: {
  p: Props; live: { startedAt: string | null; finishedAt: string | null }; sessData: Record<string, { value: string; by: string; at: string }>;
  pending: boolean; presenting: boolean; canStart: boolean;
  gateHints: { flagOk: boolean; sopOk: boolean; consentOk: boolean; photoOk: boolean };
  elapsed: number; api: (payload: Record<string, unknown>) => Promise<{ ok: boolean }>;
  onStart: () => void; onFinish: () => void; onSaveNote: (note: string) => void; onContinue: () => void;
}) {
  const [note, setNote] = useState(p.clinicalNote);
  // Live-derived until this device edits — a note saved on another device (or
  // before a reload) shows everywhere instead of looking lost.
  const [localComfort, setLocalComfort] = useState<string | null>(null);
  const comfort = localComfort ?? sessData.comfort_note?.value ?? '';
  const [savedMsg, setSavedMsg] = useState('');
  const started = !!live.startedAt;
  const finished = !!live.finishedAt;

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
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-gold-bright)]">{finished ? 'Treatment complete' : 'In treatment'}</p>
            <p className="mt-3 font-[family-name:var(--font-display)] text-6xl tabular-nums">{fmtClock(elapsed)}</p>
            <p className="mt-2 text-sm text-[color-mix(in_oklab,var(--color-porcelain)_65%,transparent)]">booked {p.booking.durationMin} min</p>
          </div>

          {!presenting && (
            <>
              <div>
                <label htmlFor="session-comfort" className="mb-1.5 block text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]">Comfort & preferences (front-of-house note)</label>
                <input id="session-comfort" value={comfort} onChange={(e) => setLocalComfort(e.target.value)}
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

              {!finished && (
                <button type="button" disabled={pending} onClick={onFinish}
                  className="inline-flex min-h-12 items-center gap-3 rounded-full bg-[var(--color-ink)] px-8 py-3.5 text-base font-medium text-[var(--color-porcelain)] transition-colors hover:bg-[var(--color-gold)] disabled:opacity-50">
                  End treatment (stops the clock)
                </button>
              )}
            </>
          )}

          {finished && <ContinueButton onClick={onContinue} label="Continue to aftercare" />}
        </>
      )}
    </>
  );
}

function AftercareStep({ p, live, sessData, api, onContinue }: {
  p: Props; live: { aftercareAckAt: string | null };
  sessData: Record<string, { value: string; by: string; at: string }>;
  api: (payload: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
  onContinue: () => void;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const confirmedBy = sessData.aftercare_confirmed_by?.value;
  const confirmed = !!confirmedBy || !!live.aftercareAckAt;

  async function confirm() {
    if (!name.trim()) { setError('Please type your name to confirm.'); return; }
    setBusy(true); setError('');
    const r = await api({ op: 'aftercare', confirmedBy: name.trim() });
    setBusy(false);
    if (!r.ok) { setError(r.error || 'Could not save — please try again.'); return; }
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
          <ContinueButton onClick={onContinue} label="Continue to checkout" />
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

function CheckoutStep({ p, live, sessData, pending, presenting, api, run, onContinue }: {
  p: Props;
  live: { finishedAt: string | null; chargedPence: number | null; chargedAt: string | null };
  sessData: Record<string, { value: string; by: string; at: string }>;
  pending: boolean; presenting: boolean;
  api: (payload: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
  onContinue: () => void;
}) {
  const [amount, setAmount] = useState(() => (p.booking.pricePence / 100).toFixed(2));
  const charged = !!live.chargedAt;

  return (
    <>
      {/* Treatment payment — charged to the card saved at booking */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-6">
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]">Today’s treatment</p>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
          <p className="font-[family-name:var(--font-display)] text-2xl">{p.booking.treatmentTitle}</p>
          <p className="font-[family-name:var(--font-display)] text-2xl tabular-nums">{charged ? money(live.chargedPence || 0) : p.booking.pricePence > 0 ? money(p.booking.pricePence) : 'On consultation'}</p>
        </div>
        {charged ? (
          <p className="mt-3 inline-flex items-center gap-2 text-sm text-[var(--color-stone)]">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--color-gold)] text-white" aria-hidden><CheckIcon /></span>
            Paid {new Date(live.chargedAt!).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} — no card needed, it’s already on file.
          </p>
        ) : !presenting && p.canCharge ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label htmlFor="charge-amount" className="sr-only">Amount in pounds</label>
            <span className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm">
              £<input id="charge-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-24 outline-none tabular-nums" />
            </span>
            <button type="button" disabled={pending || !live.finishedAt}
              onClick={() => run(() => api({ op: 'charge', amountPence: Math.round(parseFloat(amount || '0') * 100) }))}
              className="min-h-12 rounded-full bg-[var(--color-gold)] px-7 py-3 font-medium text-white transition-colors hover:bg-[var(--color-ink)] disabled:opacity-40">
              Charge the saved card
            </button>
            {!live.finishedAt && <p className="w-full text-xs text-[var(--color-stone)]">Finish the treatment first — charging unlocks once the clock stops.</p>}
          </div>
        ) : !presenting ? (
          <p className="mt-3 text-sm text-[var(--color-stone)]">Awaiting payment — a team member with charging permission completes this.</p>
        ) : (
          <p className="mt-3 text-sm text-[var(--color-stone)]">We’ll settle this against your saved card — nothing to do.</p>
        )}
      </div>

      {/* Boutique — products to take home, paid on the client's phone */}
      {p.canPos && p.products.length > 0 && (
        <Boutique p={p} sessData={sessData} api={api} presenting={presenting} />
      )}

      <ContinueButton onClick={onContinue} label="Continue to next visit" />
    </>
  );
}

function Boutique({ p, sessData, api, presenting }: {
  p: Props; sessData: Record<string, { value: string; by: string; at: string }>;
  api: (payload: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
  presenting: boolean;
}) {
  const [basket, setBasket] = useState<Record<string, number>>({});
  const [qr, setQr] = useState<{ orderId: string; qr: string; url: string; totalPence: number } | null>(null);
  const [localPaid, setLocalPaid] = useState<string | null>(null);
  // Another device's payment lands via the live snapshot; this device's via state.
  const paidNumber = localPaid ?? sessData.boutique?.value ?? null;
  const [ageOk, setAgeOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // A payment started on ANY device is recorded on the session, so a step
  // change (which unmounts this card everywhere) can't orphan a paid order.
  const pendingRaw = sessData.boutique_pending?.value || '';
  const pending = !qr && !paidNumber && pendingRaw.includes('|')
    ? { orderId: pendingRaw.split('|')[0], totalPence: Number(pendingRaw.split('|')[1]) || 0 }
    : null;

  const total = useMemo(() => Object.entries(basket).reduce((sum, [id, qty]) => {
    const prod = p.products.find((x) => x.id === id);
    return sum + (prod ? prod.pricePence * qty : 0);
  }, 0), [basket, p.products]);
  const count = Object.values(basket).reduce((a, b) => a + b, 0);
  const hasAgeRestricted = Object.entries(basket).some(([id, qty]) => qty > 0 && p.products.find((x) => x.id === id)?.ageRestricted);

  // Poll the open order (this device's QR or a resumed pending one) until the
  // client's phone payment lands.
  const watchOrderId = qr?.orderId ?? pending?.orderId ?? null;
  const watchTotal = qr?.totalPence ?? pending?.totalPence ?? 0;
  useEffect(() => {
    if (!watchOrderId || paidNumber) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch('/api/admin/pos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'status', orderId: watchOrderId }) });
        const j = await res.json().catch(() => null);
        if (j?.ok && j.status === 'PAID') {
          setLocalPaid(j.number || 'paid');
          setQr(null);
          api({ op: 'save', field: 'boutique', value: `${j.number} — ${money(watchTotal)}` }).catch(() => {});
          api({ op: 'save', field: 'boutique_pending', value: '' }).catch(() => {});
        }
      } catch { /* next tick */ }
    }, 3000);
    return () => clearInterval(id);
  }, [watchOrderId, watchTotal, paidNumber, api]);

  async function payOnPhone() {
    if (hasAgeRestricted && !ageOk) { setError('This basket includes an 18+ product — tick the age confirmation first.'); return; }
    setBusy(true); setError('');
    try {
      const items = Object.entries(basket).filter(([, q]) => q > 0).map(([productId, qty]) => ({ productId, qty }));
      const res = await fetch('/api/admin/pos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'checkout', method: 'card', items, customerName: p.client.fullName, customerEmail: p.client.email, ageVerified: hasAgeRestricted ? ageOk : undefined }),
      });
      const j = await res.json().catch(() => ({ ok: false }));
      if (j.ok && j.qr) {
        setQr({ orderId: j.orderId, qr: j.qr, url: j.url, totalPence: j.totalPence });
        api({ op: 'save', field: 'boutique_pending', value: `${j.orderId}|${j.totalPence}` }).catch(() => {});
      } else setError(j.error || 'Could not start the payment.');
    } finally { setBusy(false); }
  }

  if (paidNumber) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-gold)]/40 bg-[var(--color-bone)] p-6 text-center">
        <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[var(--color-gold)] text-white" aria-hidden><CheckIcon /></span>
        <p className="mt-3 font-[family-name:var(--font-display)] text-xl">Boutique — paid</p>
        <p className="mt-1 text-sm text-[var(--color-stone)]">Order {paidNumber}. The receipt is on its way by email; products are ready at the front desk.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]">Take the ritual home</p>
      {pending ? (
        <div className="mt-4 text-center">
          <p className="font-[family-name:var(--font-display)] text-xl tabular-nums">{money(pending.totalPence)}</p>
          <p className="mt-1 text-sm text-[var(--color-stone)]" role="status" aria-live="polite">A phone payment is in progress — this updates the moment it goes through.</p>
          {!presenting && (
            <button type="button" onClick={() => api({ op: 'save', field: 'boutique_pending', value: '' })}
              className="mt-3 text-xs text-[var(--color-stone)] underline-offset-4 hover:underline">Abandon and start a new basket</button>
          )}
        </div>
      ) : qr ? (
        <div className="mt-4 flex flex-col items-center gap-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr.qr} alt="Scan to pay on your phone" width={208} height={208} className="h-52 w-52 rounded-[var(--radius-sm)]" />
          <p className="font-[family-name:var(--font-display)] text-xl tabular-nums">{money(qr.totalPence)}</p>
          <p className="text-sm text-[var(--color-stone)]" role="status" aria-live="polite">Scan with your phone to pay — this updates the moment it goes through.</p>
          {!presenting && (
            <button type="button" onClick={() => setQr(null)} className="text-xs text-[var(--color-stone)] underline-offset-4 hover:underline">Back to the basket</button>
          )}
        </div>
      ) : (
        <>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {p.products.map((prod) => {
              const qty = basket[prod.id] || 0;
              return (
                <li key={prod.id} className={`flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border p-3 transition-colors ${qty > 0 ? 'border-[var(--color-gold)] bg-[var(--color-bone)]' : 'border-[var(--color-line)]'} ${prod.soldOut ? 'opacity-50' : ''}`}>
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{prod.name}</span>
                    <span className="text-xs tabular-nums text-[var(--color-stone)]">{money(prod.pricePence)}{prod.soldOut ? ' · out of stock' : ''}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {qty > 0 && (
                      <>
                        <button type="button" aria-label={`Remove one ${prod.name}`} onClick={() => setBasket((b) => ({ ...b, [prod.id]: Math.max(0, qty - 1) }))}
                          className="grid h-8 w-8 place-items-center rounded-full border border-[var(--color-line)] text-sm hover:border-[var(--color-gold)]">−</button>
                        <span className="w-4 text-center text-sm tabular-nums">{qty}</span>
                      </>
                    )}
                    <button type="button" aria-label={`Add ${prod.name}`} disabled={prod.soldOut} onClick={() => setBasket((b) => ({ ...b, [prod.id]: qty + 1 }))}
                      className="grid h-8 w-8 place-items-center rounded-full border border-[var(--color-line)] text-sm hover:border-[var(--color-gold)] disabled:cursor-not-allowed">＋</button>
                  </span>
                </li>
              );
            })}
          </ul>
          {count > 0 && (
            <div className="mt-4 space-y-3">
              {hasAgeRestricted && (
                <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] bg-[var(--color-bone)] p-3 text-sm">
                  <input type="checkbox" checked={ageOk} onChange={(e) => setAgeOk(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-gold)]" />
                  This basket includes an 18+ product — I confirm the buyer is over 18.
                </label>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-[family-name:var(--font-display)] text-xl tabular-nums">{money(total)} <span className="text-sm text-[var(--color-stone)]">· {count} item{count === 1 ? '' : 's'}</span></p>
                <button type="button" disabled={busy} onClick={payOnPhone}
                  className="min-h-12 rounded-full bg-[var(--color-ink)] px-7 py-3 text-sm font-medium text-[var(--color-porcelain)] transition-colors hover:bg-[var(--color-gold)] disabled:opacity-50">
                  {busy ? 'Preparing…' : 'Pay on your phone (QR)'}
                </button>
              </div>
            </div>
          )}
          {error && <p role="alert" className="mt-3 text-sm text-[var(--color-blush)]">{error}</p>}
        </>
      )}
    </div>
  );
}

function NextVisitStep({ p, sessData, api, onContinue, onSkip }: {
  p: Props; sessData: Record<string, { value: string; by: string; at: string }>;
  api: (payload: Record<string, unknown>) => Promise<{ ok: boolean; error?: string; startAt?: string; status?: string }>;
  onContinue: () => void; onSkip: () => void;
}) {
  const booked = sessData.next_visit?.value ?? null;
  const [date, setDate] = useState(p.nextRec?.dateISO || new Date(Date.now() + 28 * 864e5).toISOString().slice(0, 10));
  const [slots, setSlots] = useState<string[]>([]);
  const [slot, setSlot] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (booked) return;
    setLoading(true); setSlot('');
    // Stale-response guard: a slow reply for a previously-selected date must
    // never overwrite the list (the slot ISO would book the wrong day).
    let stale = false;
    fetch('/api/booking/availability', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: p.booking.treatmentSlug, date, durationMin: p.booking.durationMin }) })
      .then((r) => r.json()).then((j) => { if (!stale) setSlots(j.slots || []); }).catch(() => { if (!stale) setSlots([]); })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [date, booked, p.booking.treatmentSlug, p.booking.durationMin]);

  async function reserve() {
    if (!slot) return;
    setBusy(true); setError('');
    const r = await api({ op: 'rebook', startISO: slot });
    setBusy(false);
    if (!r.ok) { setError(r.error || 'Could not book — try another time.'); return; }
  }

  if (booked) {
    const d = new Date(booked);
    return (
      <>
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-gold)]/40 bg-[var(--color-bone)] p-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--color-gold)] text-white" aria-hidden><CheckIcon large /></span>
          <p className="mt-4 font-[family-name:var(--font-display)] text-2xl">You’re booked in</p>
          <p className="mt-2 text-[var(--color-stone)]">
            {p.booking.treatmentTitle} — {d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} at {d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.
            Your card stays on file; a confirmation is on its way.
          </p>
        </div>
        <ContinueButton onClick={onContinue} label="Continue to farewell" />
      </>
    );
  }

  return (
    <>
      <p className="max-w-prose leading-relaxed text-[var(--color-stone)]">
        {p.nextRec
          ? <>For lasting results we recommend your next {p.booking.treatmentTitle.toLowerCase()} in <strong className="text-[var(--color-ink)]">{p.nextRec.label}</strong>{p.nextRec.maintenance ? ' (maintenance)' : ''} — lock it in now while the diary is open.</>
          : <>Keep the momentum — choose a time for your next visit while you’re here.</>}
      </p>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
        <label htmlFor="next-date" className="mb-1.5 block text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]">Pick a day</label>
        <input id="next-date" type="date" value={date} min={new Date(Date.now() + 864e5).toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)}
          className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--color-gold)]" />
        <div className="mt-4 flex flex-wrap gap-2" role="listbox" aria-label="Available times">
          {loading ? <p className="text-sm text-[var(--color-stone)]">Checking the diary…</p>
            : slots.length === 0 ? <p className="text-sm text-[var(--color-stone)]">Nothing free that day — try another.</p>
            : slots.map((s) => (
              <button key={s} type="button" role="option" aria-selected={slot === s} onClick={() => setSlot(s)}
                className={`min-h-11 rounded-full border px-4 py-2 text-sm tabular-nums transition-colors ${slot === s ? 'border-[var(--color-gold)] bg-[var(--color-gold)] text-white' : 'border-[var(--color-line)] hover:border-[var(--color-gold)]'}`}>
                {new Date(s).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </button>
            ))}
        </div>
        {slot && (
          <button type="button" disabled={busy} onClick={reserve}
            className="mt-5 inline-flex min-h-12 items-center gap-3 rounded-full bg-[var(--color-gold)] px-8 py-3.5 text-base font-medium text-white transition-colors hover:bg-[var(--color-ink)] disabled:opacity-50">
            {busy ? 'Booking…' : <>Book it <ArrowIcon /></>}
          </button>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-[var(--color-blush)]">{error}</p>}
      </div>

      <button type="button" onClick={onSkip} className="block text-sm text-[var(--color-stone)] underline-offset-4 transition-colors hover:text-[var(--color-ink)] hover:underline">
        Not today — skip to farewell
      </button>
    </>
  );
}

function FarewellStep({ p, live, pending, sessionDone, timings, stepSeconds, onComplete }: {
  p: Props; live: { actualMinutes: number | null; finishedAt: string | null }; pending: boolean; sessionDone: boolean;
  timings: StepTimings; stepSeconds: (k: SessionStepKey) => number; onComplete: () => void;
}) {
  const total = SESSION_STEPS.reduce((s, st) => s + stepSeconds(st.key), 0);
  return (
    <>
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-gold)]/40 bg-[var(--color-bone)] p-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--color-gold)] text-white" aria-hidden><CheckIcon large /></span>
        <p className="mt-4 font-[family-name:var(--font-display)] text-3xl">Thank you, {p.client.firstName}.</p>
        <p className="mt-2 text-[var(--color-stone)]">
          {live.actualMinutes ? <>Today took {live.actualMinutes} minutes (booked {p.booking.durationMin}). </> : null}
          Your aftercare guide and Beauty Points are on your account — see you next time.
        </p>
      </div>

      {!sessionDone ? (
        <>
          <button type="button" disabled={pending || !live.finishedAt} onClick={onComplete}
            className="inline-flex min-h-12 items-center gap-3 rounded-full bg-[var(--color-gold)] px-8 py-3.5 text-base font-medium text-white transition-colors hover:bg-[var(--color-ink)] disabled:opacity-40">
            Complete the visit <ArrowIcon />
          </button>
          {!live.finishedAt && (
            <p className="text-sm text-[var(--color-stone)]">End the treatment first (Treatment step) — that records the visit, Beauty Points and review invite before the session closes.</p>
          )}
        </>
      ) : (
        total > 0 && (
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
        )
      )}

      <Link href={`/admin/bookings/${p.booking.id}`}
        className="inline-flex min-h-12 items-center gap-3 rounded-full bg-[var(--color-ink)] px-8 py-3.5 text-base font-medium text-[var(--color-porcelain)] transition-colors hover:bg-[var(--color-gold)]">
        Back to the booking <ArrowIcon />
      </Link>
    </>
  );
}

/* ── Small pieces ───────────────────────────────────────────────────────── */

function Avatar({ name, photo, size }: { name: string; photo: string | null; size: number }) {
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-full bg-[var(--color-ink)] font-[family-name:var(--font-display)] text-[10px] text-[var(--color-gold-bright)]" style={{ width: size, height: size }}>
      {name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
    </span>
  );
}

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
