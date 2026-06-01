'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Resource = { id: string; slug: string; name: string; kind: string; capacity: number; active: boolean; locationId: string | null };
type Loc = { id: string; name: string };

/** Bookable rooms / equipment (e.g. a laser machine) with concurrent capacity.
 *  A treatment that requires this slug can't exceed the resource's capacity. */
export function ResourcesManager({ resources, locations, multiLocation }: { resources: Resource[]; locations: Loc[]; multiLocation: boolean }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [kind, setKind] = useState('EQUIPMENT');
  const [capacity, setCapacity] = useState('1');
  const [locationId, setLocationId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function save() {
    if (!name.trim()) { setMsg('Enter a name.'); return; }
    setBusy(true); setMsg('');
    const res = await fetch('/api/admin/resources', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, slug, kind, capacity: Number(capacity), locationId: locationId || null }),
    });
    setBusy(false);
    if (res.ok) { setName(''); setSlug(''); setCapacity('1'); setLocationId(''); router.refresh(); }
    else { const j = await res.json().catch(() => ({})); setMsg(j.error || 'Could not save.'); }
  }

  async function act(payload: object) {
    await fetch('/api/admin/resources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    router.refresh();
  }

  const field = 'rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-sm';

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <h2 className="mb-1 font-[family-name:var(--font-display)] text-xl">Rooms &amp; equipment</h2>
      <p className="mb-4 text-sm text-[var(--color-stone)]">
        Limited resources like laser machines or treatment rooms. The <code className="text-xs">slug</code> links a resource to the
        treatments that need it (e.g. <code className="text-xs">laser</code>); capacity is how many can run at once.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-[var(--color-stone)]">Name<br /><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Laser machine" className={`${field} w-44`} /></label>
        <label className="text-xs text-[var(--color-stone)]">Slug<br /><input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="laser" className={`${field} w-28`} /></label>
        <label className="text-xs text-[var(--color-stone)]">Type<br />
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={field}>
            <option value="EQUIPMENT">Equipment</option>
            <option value="ROOM">Room</option>
          </select>
        </label>
        <label className="text-xs text-[var(--color-stone)]">Capacity<br /><input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} className={`${field} w-20`} /></label>
        {multiLocation && locations.length > 0 && (
          <label className="text-xs text-[var(--color-stone)]">Site<br />
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={field}>
              <option value="">All sites</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
        )}
        <button onClick={save} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-sm text-[var(--color-porcelain)] disabled:opacity-60">{busy ? '…' : 'Add'}</button>
      </div>
      {msg && <p className="mt-2 text-sm text-[var(--color-blush)]">{msg}</p>}

      {resources.length > 0 && (
        <ul className="mt-5 divide-y divide-[var(--color-line)] border-t border-[var(--color-line)]">
          {resources.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className={r.active ? '' : 'opacity-50'}>
                <span className="font-medium">{r.name}</span>
                <span className="text-[var(--color-stone-soft)]"> · {r.slug} · {r.kind.toLowerCase()} · ×{r.capacity}</span>
                {multiLocation && r.locationId && <span className="text-[var(--color-stone-soft)]"> · {locations.find((l) => l.id === r.locationId)?.name}</span>}
              </span>
              <span className="flex items-center gap-3">
                <button onClick={() => act({ op: 'toggle', id: r.id, active: !r.active })} className="text-xs text-[var(--color-stone)] hover:underline">{r.active ? 'Disable' : 'Enable'}</button>
                <button onClick={() => { if (confirm('Remove this resource?')) act({ op: 'remove', id: r.id }); }} className="text-xs text-[var(--color-blush)] hover:underline">Remove</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
