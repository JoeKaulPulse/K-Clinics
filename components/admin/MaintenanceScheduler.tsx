'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Window = {
  id: string; title: string; detail: string | null; startAt: string; endAt: string;
  services: string[]; impact: string | null; status: string; createdBy: string | null;
};

const STATUS_DOT: Record<string, string> = {
  SCHEDULED: 'bg-amber-400', ACTIVE: 'bg-[var(--color-jade)]', DONE: 'bg-[var(--color-stone-soft)]', CANCELLED: 'bg-[var(--color-stone-soft)]',
};

export function MaintenanceScheduler({ windows, serviceOptions }: { windows: Window[]; serviceOptions: { id: string; label: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ title: '', detail: '', startAt: '', endAt: '', impact: '', services: [] as string[] });

  const upcoming = windows.filter((w) => w.status === 'SCHEDULED' || w.status === 'ACTIVE');

  async function submit() {
    setErr('');
    if (!form.title.trim() || !form.startAt || !form.endAt) { setErr('Title, start and end are required.'); return; }
    setBusy(true);
    const r = await fetch('/api/admin/status', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'create', ...form }),
    }).then((x) => x.json()).catch(() => ({ ok: false }));
    setBusy(false);
    if (r.ok) { setOpen(false); setForm({ title: '', detail: '', startAt: '', endAt: '', impact: '', services: [] }); router.refresh(); }
    else setErr(r.error || 'Could not schedule.');
  }
  async function cancel(id: string) {
    await fetch('/api/admin/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'cancel', id }) }).catch(() => {});
    router.refresh();
  }
  const fmt = (s: string) => new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-lg">Planned maintenance</h2>
        <button onClick={() => setOpen((o) => !o)} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-bone)]">
          {open ? 'Close' : '+ Schedule a window'}
        </button>
      </div>

      {open && (
        <div className="mt-4 grid gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-4 sm:grid-cols-2">
          <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-stone-soft)] sm:col-span-2">Title
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] px-3 py-2 text-sm" placeholder="e.g. Database migration — expand step" />
          </label>
          <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-stone-soft)]">Start
            <input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-stone-soft)]">End
            <input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-stone-soft)] sm:col-span-2">Impact
            <input value={form.impact} onChange={(e) => setForm({ ...form, impact: e.target.value })} className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] px-3 py-2 text-sm" placeholder="e.g. No expected downtime · booking briefly read-only" />
          </label>
          <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-stone-soft)] sm:col-span-2">Notes
            <textarea value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} rows={2} className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] px-3 py-2 text-sm" />
          </label>
          <div className="sm:col-span-2">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-stone-soft)]">Affected areas</p>
            <div className="flex flex-wrap gap-1.5">
              {serviceOptions.map((s) => {
                const on = form.services.includes(s.id);
                return (
                  <button key={s.id} type="button" onClick={() => setForm({ ...form, services: on ? form.services.filter((x) => x !== s.id) : [...form.services, s.id] })}
                    className={`rounded-full border px-3 py-1 text-xs ${on ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'border-[var(--color-line)] hover:bg-[var(--color-bone)]'}`}>
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
          {err && <p className="text-sm text-red-600 sm:col-span-2">{err}</p>}
          <div className="sm:col-span-2">
            <button onClick={submit} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm font-medium text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Scheduling…' : 'Schedule window'}</button>
          </div>
        </div>
      )}

      {upcoming.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-stone-soft)]">No maintenance scheduled.</p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--color-line)]">
          {upcoming.map((w) => (
            <li key={w.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[w.status] || 'bg-[var(--color-stone-soft)]'}`} />
                  <p className="font-medium">{w.title}</p>
                  <span className="rounded-full bg-[var(--color-bone)] px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-[var(--color-stone)]">{w.status.toLowerCase()}</span>
                </div>
                <p className="mt-0.5 text-sm text-[var(--color-stone)]">{fmt(w.startAt)} → {fmt(w.endAt)}{w.impact ? ` · ${w.impact}` : ''}</p>
                {w.detail && <p className="mt-0.5 text-xs text-[var(--color-stone-soft)]">{w.detail}</p>}
                {w.services.length > 0 && <p className="mt-0.5 text-xs text-[var(--color-stone-soft)]">Affects: {w.services.join(', ')}</p>}
              </div>
              <button onClick={() => cancel(w.id)} className="shrink-0 text-xs text-[var(--color-stone)] hover:text-red-600">Cancel</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
