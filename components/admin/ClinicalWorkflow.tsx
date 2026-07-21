'use client';

import { useEffect, useState, useTransition } from 'react';
import { reviewMedicalFlag, startAppointment, finishAppointment, saveSopChecklist } from '@/app/admin/bookings/clinical-actions';

type SopStep = { step: string; capture: boolean };
type SavedItem = { step: string; checked: boolean; response?: string };

type Props = {
  bookingId: string;
  sop: { title: string; content: string };
  sopSteps: SopStep[];
  sopSaved: SavedItem[] | null;
  /** Decrypted flag text — passed ONLY to clinical viewers (clients.clinical.view). Null when redacted. */
  medicalFlag: string | null;
  /** Whether a flag exists at all — drives the safety gate for everyone, so
   *  redacting the text for non-clinical viewers never silently satisfies it. */
  hasMedicalFlag: boolean;
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

export function ClinicalWorkflow({ bookingId, sop, sopSteps, sopSaved, medicalFlag, hasMedicalFlag, state }: Props) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');

  const sopOk = !!state.sopAcknowledgedAt;
  // Gate on flag PRESENCE, not the decrypted text: a non-clinical viewer gets a
  // null `medicalFlag` (redacted) but must still see the gate block their start.
  const flagOk = !hasMedicalFlag || !!state.medicalFlagReviewedAt;
  const started = !!state.startedAt;
  const finished = !!state.finishedAt;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => { setErr(''); const r = await fn(); if (!r.ok) setErr(r.error || 'Action failed'); });

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <h2 className="mb-1 font-[family-name:var(--font-display)] text-xl">Appointment workflow</h2>
      <p className="mb-5 text-sm text-[var(--color-stone)]">Complete the pre-checks, then run the appointment clock.</p>

      {/* Medical flag — presence shows the gate to everyone; the decrypted text
          only to clinical viewers (clients.clinical.view), else a neutral notice. */}
      {hasMedicalFlag && (
        <div className={`mb-4 rounded-[var(--radius-md)] border p-4 ${flagOk ? 'border-[var(--color-line)] bg-[var(--color-bone)]' : 'border-[var(--color-blush)] bg-[var(--color-blush)]/15'}`}>
          <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-ink)]">
            <span aria-hidden>⚠</span> Medical flag
          </p>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{medicalFlag ?? 'On file — view permission required.'}</p>
          {flagOk ? (
            <p className="mt-2 text-xs text-[var(--color-jade)]">Reviewed ✓</p>
          ) : (
            <button disabled={pending} onClick={() => run(() => reviewMedicalFlag(bookingId))} className="mt-3 rounded-full bg-[var(--color-ink)] px-4 py-2 text-xs font-medium text-[var(--color-porcelain)] disabled:opacity-60">
              I’ve reviewed this medical flag
            </button>
          )}
        </div>
      )}

      {/* SOP checklist */}
      <SopChecklist bookingId={bookingId} title={sop.title} steps={sopSteps} saved={sopSaved} acknowledged={sopOk} disabled={pending} />

      {/* Timer + start/finish */}
      <Timer state={state} />

      {err && <p role="alert" aria-live="assertive" className="mt-3 rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-3 py-2 text-sm">{err}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {!started && !finished && (
          <button disabled={pending || !sopOk || !flagOk} onClick={() => run(() => startAppointment(bookingId))}
            className="rounded-full bg-[var(--color-gold-deep)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-ink)] disabled:opacity-40">
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

function SopChecklist({ bookingId, title, steps, saved, acknowledged, disabled }: {
  bookingId: string; title: string; steps: SopStep[]; saved: SavedItem[] | null; acknowledged: boolean; disabled: boolean;
}) {
  // Seed state from any saved progress, else from the SOP definition.
  const [items, setItems] = useState<SavedItem[]>(() =>
    steps.map((s, i) => {
      const prev = saved?.[i];
      return { step: s.step, checked: prev?.checked ?? false, response: prev?.response ?? '' };
    }),
  );
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const [collapsed, setCollapsed] = useState(acknowledged);

  const allChecked = items.length > 0 && items.every((i) => i.checked);
  const doneCount = items.filter((i) => i.checked).length;

  function toggle(i: number) { setItems((s) => s.map((x, j) => (j === i ? { ...x, checked: !x.checked } : x))); }
  function setResponse(i: number, v: string) { setItems((s) => s.map((x, j) => (j === i ? { ...x, response: v } : x))); }

  function save() {
    start(async () => {
      setMsg('');
      const r = await saveSopChecklist(bookingId, items, allChecked);
      setMsg(r.ok ? (allChecked ? 'Completed ✓' : 'Saved ✓') : r.error || 'Could not save');
    });
  }

  return (
    <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-line)] p-4">
      <button onClick={() => setCollapsed((c) => !c)} className="flex w-full items-center justify-between text-left">
        <span className="text-sm font-medium">SOP checklist · {title}</span>
        <span className="flex items-center gap-2 text-xs">
          <span className={allChecked ? 'text-[var(--color-jade)]' : 'text-[var(--color-stone)]'}>{doneCount}/{items.length}</span>
          <span className="text-[var(--color-gold-deep)]">{collapsed ? 'Open' : 'Hide'}</span>
        </span>
      </button>

      {!collapsed && (
        <ul className="mt-3 space-y-2.5">
          {steps.map((s, i) => (
            <li key={i}>
              <label className="flex items-start gap-2.5">
                <input type="checkbox" checked={items[i]?.checked ?? false} onChange={() => toggle(i)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-gold)]" />
                <span className={`min-w-0 break-words text-sm ${items[i]?.checked ? 'text-[var(--color-stone)]' : 'text-[var(--color-ink-soft)]'}`}>{s.step}</span>
              </label>
              {s.capture && (
                <input
                  value={items[i]?.response ?? ''}
                  onChange={(e) => setResponse(i, e.target.value)}
                  placeholder="Client's response / note…"
                  aria-label="Client response"
                  className="mt-1.5 ml-7 w-[calc(100%-1.75rem)] rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[var(--color-gold)]"
                />
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-center gap-3">
        <button onClick={save} disabled={disabled || pending} className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-xs font-medium text-[var(--color-porcelain)] disabled:opacity-60">
          {pending ? 'Saving…' : allChecked ? 'Complete checklist' : 'Save progress'}
        </button>
        {acknowledged && <span className="text-xs text-[var(--color-jade)]">✓ Completed</span>}
        {msg && <span className="text-xs text-[var(--color-stone)]">{msg}</span>}
      </div>
    </div>
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
        <span className={delta > 0 ? ' text-[var(--color-blush-deep)]' : ' text-[var(--color-jade)]'}> · {delta > 0 ? `+${delta}` : delta} min</span>
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
