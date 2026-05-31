'use client';

import { useEffect, useState, useTransition } from 'react';
import { acknowledgeSop, reviewMedicalFlag, startAppointment, finishAppointment } from '@/app/admin/bookings/clinical-actions';

type Props = {
  bookingId: string;
  sop: { title: string; content: string };
  medicalFlag: string | null;
  state: {
    sopAcknowledgedAt: string | null;
    medicalFlagReviewedAt: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    actualMinutes: number | null;
    durationMin: number;
    status: string;
  };
};

export function ClinicalWorkflow({ bookingId, sop, medicalFlag, state }: Props) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  const [showSop, setShowSop] = useState(false);

  const sopOk = !!state.sopAcknowledgedAt;
  const flagOk = !medicalFlag || !!state.medicalFlagReviewedAt;
  const started = !!state.startedAt;
  const finished = !!state.finishedAt;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => { setErr(''); const r = await fn(); if (!r.ok) setErr(r.error || 'Action failed'); });

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <h2 className="mb-1 font-[family-name:var(--font-display)] text-xl">Appointment workflow</h2>
      <p className="mb-5 text-sm text-[var(--color-stone)]">Complete the pre-checks, then run the appointment clock.</p>

      {/* Medical flag */}
      {medicalFlag && (
        <div className={`mb-4 rounded-[var(--radius-md)] border p-4 ${flagOk ? 'border-[var(--color-line)] bg-[var(--color-bone)]' : 'border-[var(--color-blush)] bg-[var(--color-blush)]/15'}`}>
          <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-ink)]">
            <span aria-hidden>⚠</span> Medical flag
          </p>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{medicalFlag}</p>
          {flagOk ? (
            <p className="mt-2 text-xs text-[var(--color-jade)]">Reviewed ✓</p>
          ) : (
            <button disabled={pending} onClick={() => run(() => reviewMedicalFlag(bookingId))} className="mt-3 rounded-full bg-[var(--color-ink)] px-4 py-2 text-xs font-medium text-[var(--color-porcelain)] disabled:opacity-60">
              I’ve reviewed this medical flag
            </button>
          )}
        </div>
      )}

      {/* SOP */}
      <div className={`mb-4 rounded-[var(--radius-md)] border p-4 ${sopOk ? 'border-[var(--color-line)] bg-[var(--color-bone)]' : 'border-[var(--color-line)]'}`}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{sop.title}</p>
          <button onClick={() => setShowSop((s) => !s)} className="text-xs text-[var(--color-gold)]">{showSop ? 'Hide' : 'View SOP'}</button>
        </div>
        {showSop && <pre className="mt-3 whitespace-pre-wrap font-[family-name:var(--font-sans)] text-sm leading-relaxed text-[var(--color-ink-soft)]">{sop.content}</pre>}
        {sopOk ? (
          <p className="mt-2 text-xs text-[var(--color-jade)]">Acknowledged ✓</p>
        ) : (
          <button disabled={pending} onClick={() => run(() => acknowledgeSop(bookingId))} className="mt-3 rounded-full bg-[var(--color-ink)] px-4 py-2 text-xs font-medium text-[var(--color-porcelain)] disabled:opacity-60">
            I’ve reviewed the SOP
          </button>
        )}
      </div>

      {/* Timer + start/finish */}
      <Timer state={state} />

      {err && <p className="mt-3 rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-3 py-2 text-sm">{err}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {!started && !finished && (
          <button disabled={pending || !sopOk || !flagOk} onClick={() => run(() => startAppointment(bookingId))}
            className="rounded-full bg-[var(--color-gold)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-ink)] disabled:opacity-40">
            ▶ Start appointment
          </button>
        )}
        {started && !finished && (
          <button disabled={pending} onClick={() => run(() => finishAppointment(bookingId))}
            className="rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm font-medium text-[var(--color-porcelain)] disabled:opacity-60">
            ■ Finish appointment
          </button>
        )}
      </div>
      {(!sopOk || !flagOk) && !started && !finished && (
        <p className="mt-2 text-xs text-[var(--color-stone)]">Complete the pre-checks above to enable “Start”.</p>
      )}
    </section>
  );
}

function Timer({ state }: { state: Props['state'] }) {
  const [elapsed, setElapsed] = useState(0);
  const running = !!state.startedAt && !state.finishedAt;

  useEffect(() => {
    if (!running || !state.startedAt) return;
    const startedMs = new Date(state.startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - startedMs) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [running, state.startedAt]);

  if (state.finishedAt && state.actualMinutes != null) {
    const delta = state.actualMinutes - state.durationMin;
    return (
      <div className="rounded-[var(--radius-md)] bg-[var(--color-bone)] p-4 text-sm">
        Completed in <strong>{state.actualMinutes} min</strong> (booked {state.durationMin} min)
        <span className={delta > 0 ? ' text-[var(--color-blush)]' : ' text-[var(--color-jade)]'}> · {delta > 0 ? `+${delta}` : delta} min</span>
      </div>
    );
  }
  if (running) {
    const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const ss = String(elapsed % 60).padStart(2, '0');
    return (
      <div className="flex items-center gap-3 rounded-[var(--radius-md)] bg-[var(--color-ink)] p-4 text-[var(--color-porcelain)]">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--color-gold-soft)]" />
        <span className="font-[family-name:var(--font-display)] text-2xl tabular-nums">{mm}:{ss}</span>
        <span className="text-sm text-[color-mix(in_oklab,var(--color-porcelain)_70%,transparent)]">in progress · booked {state.durationMin} min</span>
      </div>
    );
  }
  return <div className="rounded-[var(--radius-md)] bg-[var(--color-bone)] p-4 text-sm text-[var(--color-stone)]">Not started · booked {state.durationMin} min</div>;
}
