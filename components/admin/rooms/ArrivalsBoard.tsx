'use client';

import { useState } from 'react';
import Link from 'next/link';

// PRJ-63.5 — front-of-house arrivals timeline with one-tap check-in. Reception
// taps "Check in" when a client arrives; it stamps arrivedAt (optimistic) and the
// clinician view reflects it. No clinical fields here — front-of-house only.
export type ArrivalRow = {
  id: string;
  clientId: string;
  timeLabel: string;
  client: string;
  treatment: string;
  room: string | null;
  status: string;
  arrived: boolean;
  done: boolean;
};

export function ArrivalsBoard({ initialArrivals, canManage }: { initialArrivals: ArrivalRow[]; canManage: boolean }) {
  const [rows, setRows] = useState<ArrivalRow[]>(initialArrivals);
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(id: string, next: boolean) {
    if (busy) return;
    setBusy(id);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, arrived: next } : r)));
    try {
      const res = await fetch('/api/admin/bookings/arrive', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: id, arrived: next }),
      });
      if (!res.ok) setRows((prev) => prev.map((r) => (r.id === id ? { ...r, arrived: !next } : r)));
    } catch { setRows((prev) => prev.map((r) => (r.id === id ? { ...r, arrived: !next } : r))); }
    finally { setBusy(null); }
  }

  if (rows.length === 0) {
    return <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-line)] bg-[var(--color-bone)]/40 px-6 py-8 text-center text-sm text-[var(--color-stone)]">No appointments today.</p>;
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
      {rows.map((r) => (
        <div key={r.id} className={`flex items-center gap-3 border-b border-[var(--color-line)] px-4 py-3 last:border-0 ${r.arrived && !r.done ? 'bg-[color-mix(in_oklab,var(--color-jade)_7%,transparent)]' : ''}`}>
          <span className="w-12 shrink-0 font-[family-name:var(--font-display)] text-base tabular-nums text-[var(--color-gold)]">{r.timeLabel}</span>
          {/* Open the appointment itself (not just the client profile) straight from the board. */}
          <Link href={`/admin/bookings/${r.id}`} className="group min-w-0 flex-1">
            <span className="block truncate text-sm font-medium group-hover:text-[var(--color-gold)]">{r.client}</span>
            <span className="block truncate text-xs text-[var(--color-stone)]">{r.treatment}{r.room ? ` · ${r.room}` : ''}</span>
            <span className="text-[0.65rem] text-[var(--color-stone)] opacity-0 transition-opacity group-hover:opacity-100">Open appointment →</span>
          </Link>
          <Link href={`/admin/clients/${r.clientId}`} title="Open client profile" className="hidden shrink-0 rounded-full border border-[var(--color-line)] px-2.5 py-1.5 text-xs text-[var(--color-stone)] hover:bg-[var(--color-bone)] sm:inline-block">Profile</Link>
          {r.done ? (
            <span className="shrink-0 rounded-full bg-[var(--color-ink)] px-2.5 py-1 text-xs font-medium text-[var(--color-porcelain)]">Done</span>
          ) : canManage ? (
            <button
              type="button"
              onClick={() => toggle(r.id, !r.arrived)}
              disabled={busy === r.id}
              aria-pressed={r.arrived}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)] ${
                r.arrived ? 'bg-[color-mix(in_oklab,var(--color-jade)_16%,transparent)] text-[var(--color-jade)]' : 'border border-[var(--color-line)] text-[var(--color-ink)] hover:bg-[var(--color-bone)]'
              }`}
            >
              {r.arrived ? '✓ Arrived' : 'Check in'}
            </button>
          ) : (
            r.arrived && <span className="shrink-0 rounded-full bg-[color-mix(in_oklab,var(--color-jade)_16%,transparent)] px-2.5 py-1 text-xs font-medium text-[var(--color-jade)]">Arrived</span>
          )}
        </div>
      ))}
    </div>
  );
}
