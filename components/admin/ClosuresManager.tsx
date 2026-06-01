'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Closure = { id: string; startAt: string; endAt: string; reason: string | null; locationId: string | null };
type Loc = { id: string; name: string };

/** Clinic-wide closures & holidays — block all staff for a date or range. */
export function ClosuresManager({ closures, locations, multiLocation }: { closures: Closure[]; locations: Loc[]; multiLocation: boolean }) {
  const router = useRouter();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const [locationId, setLocationId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const locName = (id: string | null) => (id ? locations.find((l) => l.id === id)?.name ?? 'A site' : 'All sites');
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  async function add() {
    if (!start) { setMsg('Pick a date.'); return; }
    setBusy(true); setMsg('');
    const res = await fetch('/api/admin/closures', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate: start, endDate: end || start, reason, locationId: locationId || null }),
    });
    setBusy(false);
    if (res.ok) { setStart(''); setEnd(''); setReason(''); setLocationId(''); router.refresh(); }
    else { const j = await res.json().catch(() => ({})); setMsg(j.error || 'Could not add.'); }
  }

  async function remove(id: string) {
    if (!confirm('Remove this closure?')) return;
    await fetch('/api/admin/closures', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'remove', id }) });
    router.refresh();
  }

  const field = 'rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-sm';

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <h2 className="mb-1 font-[family-name:var(--font-display)] text-xl">Clinic closures &amp; holidays</h2>
      <p className="mb-4 text-sm text-[var(--color-stone)]">Block bookings across all staff for a date or range — bank holidays, training days, refurbishments.</p>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-[var(--color-stone)]">From<br /><input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={field} /></label>
        <label className="text-xs text-[var(--color-stone)]">To (optional)<br /><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={field} /></label>
        <label className="text-xs text-[var(--color-stone)]">Reason<br /><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Bank holiday" className={`${field} w-40`} /></label>
        {multiLocation && locations.length > 0 && (
          <label className="text-xs text-[var(--color-stone)]">Site<br />
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={field}>
              <option value="">All sites</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
        )}
        <button onClick={add} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-sm text-[var(--color-porcelain)] disabled:opacity-60">{busy ? '…' : 'Add closure'}</button>
      </div>
      {msg && <p className="mt-2 text-sm text-[var(--color-blush)]">{msg}</p>}

      {closures.length > 0 && (
        <ul className="mt-5 divide-y divide-[var(--color-line)] border-t border-[var(--color-line)]">
          {closures.map((c) => {
            const sameDay = fmt(c.startAt) === fmt(c.endAt);
            return (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  <span className="font-medium">{sameDay ? fmt(c.startAt) : `${fmt(c.startAt)} – ${fmt(c.endAt)}`}</span>
                  {c.reason ? ` · ${c.reason}` : ''}
                  {multiLocation && <span className="text-[var(--color-stone-soft)]"> · {locName(c.locationId)}</span>}
                </span>
                <button onClick={() => remove(c.id)} className="text-xs text-[var(--color-blush)] hover:underline">Remove</button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
