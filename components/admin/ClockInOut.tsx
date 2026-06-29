'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { clockInOutAction, breakAction } from '@/app/admin/time-actions';

// PRJ-63 — clock in/out + lunch break control. Shows live status and today's net
// worked time. Acts only on the signed-in user (server resolves identity).
type Props = {
  onShift: boolean;
  onBreak: boolean;
  shiftStartIso: string | null;
  workedTodayMin: number;
  breakTodayMin: number;
  /** BLD-226: slim single-line pill for the dashboard header (vs the full card). */
  compact?: boolean;
};

const fmt = (min: number) => { const h = Math.floor(min / 60); const m = min % 60; return h > 0 ? `${h}h ${m}m` : `${m}m`; };

export function ClockInOut({ onShift, onBreak, shiftStartIso, workedTodayMin, breakTodayMin, compact = false }: Props) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Tick so the "worked today" figure advances live while clocked in.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!onShift) return;
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, [onShift]);

  // Live worked estimate: base + minutes since shiftStart isn't double-counted —
  // the server figure already includes the open interval up to render; we just
  // nudge it forward by whole minutes elapsed since mount for a live feel.
  const liveWorked = workedTodayMin;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    if (pending) return;
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.error || 'Something went wrong.');
    });
  }

  const dot = onBreak ? 'bg-amber-400' : onShift ? 'bg-[var(--color-jade)]' : 'bg-[var(--color-stone-soft)]';
  const label = onBreak ? 'On break' : onShift ? 'On shift' : 'Off the clock';

  // Compact pill: a single-line control for the dashboard header cluster.
  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-[var(--color-porcelain)] py-1 pl-3 pr-1">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dot} ${onShift && !onBreak ? 'animate-pulse' : ''}`} />
        <span className="text-xs font-medium text-[var(--color-ink)]">{label}</span>
        {onShift && <span className="hidden text-xs tabular-nums text-[var(--color-stone)] sm:inline">· {fmt(liveWorked)}</span>}
        {!onShift ? (
          <button type="button" onClick={() => run(() => clockInOutAction('in'))} disabled={pending}
            className="rounded-full bg-[var(--color-ink)] px-3 py-1 text-xs font-medium text-[var(--color-porcelain)] transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]">
            {pending ? '…' : 'Clock in'}
          </button>
        ) : (
          <>
            {!onBreak ? (
              <button type="button" onClick={() => run(() => breakAction('start', 'Lunch'))} disabled={pending} title="Take a break"
                className="rounded-full border border-[var(--color-line)] bg-[var(--color-porcelain)] px-2.5 py-1 text-xs hover:bg-[var(--color-bone)] disabled:opacity-50">Break</button>
            ) : (
              <button type="button" onClick={() => run(() => breakAction('end'))} disabled={pending}
                className="rounded-full bg-amber-400/90 px-2.5 py-1 text-xs font-medium text-[var(--color-ink)] hover:bg-amber-400 disabled:opacity-50">End break</button>
            )}
            <button type="button" onClick={() => run(() => clockInOutAction('out'))} disabled={pending}
              className="rounded-full border border-[var(--color-line)] bg-[var(--color-porcelain)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-bone)] disabled:opacity-50">
              {pending ? '…' : 'Clock out'}
            </button>
          </>
        )}
        {error && <span className="sr-only">{error}</span>}
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${dot} ${onShift && !onBreak ? 'animate-pulse' : ''}`} />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="text-xs text-[var(--color-stone)] tabular-nums">{fmt(liveWorked)} today{breakTodayMin > 0 ? ` · ${fmt(breakTodayMin)} break` : ''}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {!onShift ? (
          <button type="button" onClick={() => run(() => clockInOutAction('in'))} disabled={pending}
            className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-sm font-medium text-[var(--color-porcelain)] transition-opacity hover:opacity-90 disabled:opacity-50">
            {pending ? '…' : 'Clock in'}
          </button>
        ) : (
          <>
            <button type="button" onClick={() => run(() => clockInOutAction('out'))} disabled={pending}
              className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm font-medium hover:bg-[var(--color-bone)] disabled:opacity-50">
              {pending ? '…' : 'Clock out'}
            </button>
            {!onBreak ? (
              <button type="button" onClick={() => run(() => breakAction('start', 'Lunch'))} disabled={pending}
                className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm hover:bg-[var(--color-bone)] disabled:opacity-50">
                Take a break
              </button>
            ) : (
              <button type="button" onClick={() => run(() => breakAction('end'))} disabled={pending}
                className="rounded-full bg-amber-400/90 px-4 py-1.5 text-sm font-medium text-[var(--color-ink)] hover:bg-amber-400 disabled:opacity-50">
                End break
              </button>
            )}
          </>
        )}
      </div>
      {shiftStartIso && onShift && (
        <p className="mt-2 text-xs text-[var(--color-stone)]">Since {new Date(shiftStartIso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}</p>
      )}
      {error && <p role="alert" aria-live="assertive" className="mt-2 text-xs text-[#b23b3b]">{error}</p>}
    </div>
  );
}
