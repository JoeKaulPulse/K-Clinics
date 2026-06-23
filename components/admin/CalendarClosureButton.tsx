'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Closure = { id: string; reason: string | null };

/** BLD-564: close (or reopen) the WHOLE clinic for a day, straight from the
 *  calendar. A closure blocks all online bookings for every clinician on that
 *  date — the booking engine (lib/availability.ts) already enforces it. Distinct
 *  from "Block time", which only blocks one clinician. Needs schedule.manage. */
export function CalendarClosureButton({ dateISO, closure }: { dateISO: string; closure: Closure | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function post(body: object) {
    setBusy(true); setMsg('');
    const res = await fetch('/api/admin/closures', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setBusy(false);
    if (res.ok) { setOpen(false); setReason(''); router.refresh(); }
    else { const j = await res.json().catch(() => ({})); setMsg(j.error || 'Could not update.'); }
  }

  // Already closed → offer to reopen (removes the closure).
  if (closure) {
    return (
      <button
        onClick={() => { if (confirm('Reopen the clinic this day? Online bookings will be offered again.')) post({ op: 'remove', id: closure.id }); }}
        disabled={busy}
        className="rounded-full border border-[var(--color-blush)]/50 px-3 py-1.5 text-sm font-medium text-[var(--color-blush)] hover:bg-[var(--color-blush)]/10 disabled:opacity-60"
      >{busy ? '…' : 'Reopen clinic'}</button>
    );
  }

  if (!open) {
    return <button onClick={() => setOpen(true)} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-sm font-medium hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]">Close clinic</button>;
  }

  return (
    <div className="absolute right-0 top-12 z-30 w-72 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-4 shadow-[var(--shadow-soft)]">
      <p className="mb-1 text-sm font-medium">Close the whole clinic</p>
      <p className="mb-2 text-xs text-[var(--color-stone)]">Blocks all online bookings for every clinician on {dateISO}.</p>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional, e.g. Bank holiday)" className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm" />
      {msg && <p className="mt-2 text-xs text-[var(--color-blush)]">{msg}</p>}
      <div className="mt-3 flex gap-2">
        <button onClick={() => post({ startDate: dateISO, reason })} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-xs text-[var(--color-porcelain)] disabled:opacity-60">{busy ? '…' : 'Close clinic'}</button>
        <button onClick={() => { setOpen(false); setMsg(''); }} className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-xs text-[var(--color-stone)]">Cancel</button>
      </div>
    </div>
  );
}
