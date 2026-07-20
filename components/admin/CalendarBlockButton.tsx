'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Clinician = { id: string; name: string };

/** Quick "block time" control on the calendar — creates an approved staff
 *  time-off block for the chosen clinician/day without leaving the calendar. */
export function CalendarBlockButton({ clinicians, dateISO }: { clinicians: Clinician[]; dateISO: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [staffId, setStaffId] = useState(clinicians[0]?.id ?? '');
  const [start, setStart] = useState('12:00');
  const [end, setEnd] = useState('13:00');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function submit() {
    if (!staffId) { setMsg('Pick a clinician.'); return; }
    setBusy(true); setMsg('');
    const res = await fetch('/api/admin/schedule', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'addTimeOff', staffId, kind: 'BLOCKED', startAt: `${dateISO}T${start}:00`, endAt: `${dateISO}T${end}:00`, reason }),
    });
    setBusy(false);
    if (res.ok) { setOpen(false); setReason(''); router.refresh(); }
    else { const j = await res.json().catch(() => ({})); setMsg(j.error || 'Could not block.'); }
  }

  const field = 'rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm';

  if (!open) {
    return <button onClick={() => setOpen(true)} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-sm font-medium hover:border-[var(--color-gold)] hover:text-[var(--color-gold-deep)]">Block time</button>;
  }

  return (
    <div className="absolute right-0 top-12 z-30 w-72 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-4 shadow-[var(--shadow-soft)]">
      <p className="mb-2 text-sm font-medium">Block time</p>
      <div className="space-y-2">
        <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className={`${field} w-full`}>
          {clinicians.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={field} />
          <span className="text-[var(--color-stone)]">–</span>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={field} />
        </div>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className={`${field} w-full`} />
      </div>
      {msg && <p className="mt-2 text-xs text-[var(--color-blush-deep)]">{msg}</p>}
      <div className="mt-3 flex gap-2">
        <button onClick={submit} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-xs text-[var(--color-porcelain)] disabled:opacity-60">{busy ? '…' : 'Block'}</button>
        <button onClick={() => { setOpen(false); setMsg(''); }} className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-xs text-[var(--color-stone)]">Cancel</button>
      </div>
    </div>
  );
}
