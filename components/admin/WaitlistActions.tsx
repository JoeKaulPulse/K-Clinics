'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { searchClientsForBooking } from '@/app/admin/bookings/create-action';

const f = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)] focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]';

// BLD-1646 — per-row actions on the waitlist admin page: notify the client a
// slot's available (staff already agreed one by phone), or remove someone who
// calls to withdraw. `fromDateISO` seeds the notify form with the start of the
// entry's own waiting window so staff usually only need to adjust the time.
export function WaitlistRowActions({ id, fromDateISO }: { id: string; fromDateISO: string }) {
  const router = useRouter();
  const [open, setOpen] = useState<'notify' | null>(null);
  const [date, setDate] = useState(fromDateISO);
  const [time, setTime] = useState('10:00');
  const [pending, start] = useTransition();
  const [error, setError] = useState('');

  function send() {
    setError('');
    start(async () => {
      const slotStart = date ? new Date(`${date}T${time}`).toISOString() : undefined;
      const r = await fetch(`/api/admin/waitlist/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'notify', slotStart }),
      }).then((x) => x.json()).catch(() => ({ ok: false, error: 'Network error.' }));
      if (r.ok) { setOpen(null); router.refresh(); } else setError(r.error || 'Could not send the notification.');
    });
  }

  function remove() {
    if (!window.confirm('Remove this person from the waitlist? This cannot be undone from here.')) return;
    setError('');
    start(async () => {
      const r = await fetch(`/api/admin/waitlist/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove' }),
      }).then((x) => x.json()).catch(() => ({ ok: false, error: 'Network error.' }));
      if (r.ok) router.refresh(); else setError(r.error || 'Could not remove the entry.');
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setOpen(open === 'notify' ? null : 'notify')} disabled={pending}
          className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs font-medium hover:border-[var(--color-gold)] disabled:opacity-50">
          Notify
        </button>
        <button type="button" onClick={remove} disabled={pending}
          className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs font-medium text-[var(--color-blush-deep)] hover:border-[var(--color-blush-deep)] disabled:opacity-50">
          Remove
        </button>
      </div>
      {open === 'notify' && (
        <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bone)]/60 p-2.5">
          <input type="date" className={`${f} w-auto`} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Freed slot date" />
          <input type="time" className={`${f} w-auto`} value={time} onChange={(e) => setTime(e.target.value)} aria-label="Freed slot time" />
          <button type="button" onClick={send} disabled={pending} className="rounded-full bg-[var(--color-gold-deep)] px-3.5 py-1.5 text-xs font-medium text-white disabled:opacity-60">
            {pending ? 'Sending…' : 'Send offer'}
          </button>
          <button type="button" onClick={() => setOpen(null)} className="text-xs text-[var(--color-stone)] hover:underline">Cancel</button>
        </div>
      )}
      {error && <p role="alert" className="text-xs text-[var(--color-blush-deep)]">{error}</p>}
    </div>
  );
}

type Found = { id: string; firstName: string; lastName: string | null; email: string; phone: string | null };

// Staff-initiated waitlist signup (BLD-1646) — a client calls to ask to be put
// on the list, or staff spot a good candidate while on the phone.
export function AddToWaitlistButton({ treatments }: { treatments: { slug: string; title: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [matches, setMatches] = useState<Found[]>([]);
  const [selected, setSelected] = useState<Found | null>(null);
  const [treatmentSlug, setTreatmentSlug] = useState(treatments[0]?.slug ?? '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState('');

  useEffect(() => {
    if (selected || q.trim().length < 2) { setMatches([]); return; }
    const t = setTimeout(async () => {
      const r = await searchClientsForBooking(q);
      if (r.ok) setMatches(r.clients);
    }, 300);
    return () => clearTimeout(t);
  }, [q, selected]);

  function reset() {
    setOpen(false); setSelected(null); setQ(''); setMatches([]); setFrom(''); setTo(''); setError('');
  }

  function submit() {
    setError('');
    if (!selected) return setError('Find and select the client.');
    if (!from || !to) return setError('Choose a date window.');
    if (to < from) return setError('Window end is before its start.');
    start(async () => {
      const r = await fetch('/api/admin/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: selected.id, treatmentSlug, fromDate: from, toDate: to }),
      }).then((x) => x.json()).catch(() => ({ ok: false, error: 'Network error.' }));
      if (r.ok) { reset(); router.refresh(); } else setError(r.error || 'Could not add to the waitlist.');
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-[var(--color-porcelain)] hover:bg-[var(--color-espresso)]">
        + Add to waitlist
      </button>
    );
  }

  return (
    <div className="max-w-xl space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
      <p className="text-sm font-medium">Add a client to the waitlist</p>
      {selected ? (
        <div className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm">
          <span>{selected.firstName} {selected.lastName ?? ''} · {selected.email}{selected.phone ? ` · ${selected.phone}` : ''}</span>
          <button type="button" onClick={() => setSelected(null)} className="text-xs text-[var(--color-stone)] hover:underline">Change</button>
        </div>
      ) : (
        <div>
          <input className={f} placeholder="Search client by name, email or phone…" aria-label="Search clients" value={q} onChange={(e) => setQ(e.target.value)} />
          {matches.length > 0 && (
            <div className="mt-1 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-line)]">
              {matches.map((c) => (
                <button key={c.id} type="button" onClick={() => { setSelected(c); setQ(''); }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[var(--color-bone)]">
                  <span>{c.firstName} {c.lastName ?? ''} <span className="text-[var(--color-stone)]">· {c.email}</span></span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <select className={f} value={treatmentSlug} onChange={(e) => setTreatmentSlug(e.target.value)} aria-label="Treatment">
        {treatments.map((t) => <option key={t.slug} value={t.slug}>{t.title}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs text-[var(--color-stone)]">From
          <input className={`${f} mt-1`} type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Window start" />
        </label>
        <label className="block text-xs text-[var(--color-stone)]">To
          <input className={`${f} mt-1`} type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Window end" />
        </label>
      </div>
      {error && <p role="alert" className="text-xs text-[var(--color-blush-deep)]">{error}</p>}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={reset} className="px-3 py-2 text-sm text-[var(--color-stone)]">Cancel</button>
        <button type="button" onClick={submit} disabled={pending} className="rounded-full bg-[var(--color-gold-deep)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {pending ? 'Adding…' : 'Add to waitlist'}
        </button>
      </div>
    </div>
  );
}
