'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Resource = { id: string; slug: string; name: string; kind: string; tags: string[]; floor: string | null; capacity: number; active: boolean; locationId: string | null };
type Loc = { id: string; name: string };

const field = 'rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-sm';

/** Treatment rooms (named, auto-assigned) and shared equipment (laser/HIFU).
 *  Bookings auto-hold a free capable room + any equipment the treatment needs. */
export function ResourcesManager({ resources, locations, multiLocation }: { resources: Resource[]; locations: Loc[]; multiLocation: boolean }) {
  const rooms = resources.filter((r) => r.kind === 'ROOM');
  const equipment = resources.filter((r) => r.kind === 'EQUIPMENT');
  return (
    <>
      <RoomSection rooms={rooms} locations={locations} multiLocation={multiLocation} />
      <EquipmentSection equipment={equipment} locations={locations} multiLocation={multiLocation} />
    </>
  );
}

async function post(payload: object) {
  return fetch('/api/admin/resources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

function RoomSection({ rooms, locations, multiLocation }: { rooms: Resource[]; locations: Loc[]; multiLocation: boolean }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [floor, setFloor] = useState('');
  const [tags, setTags] = useState('aesthetics');
  const [locationId, setLocationId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function add() {
    if (!name.trim()) { setMsg('Name the room.'); return; }
    setBusy(true); setMsg('');
    const res = await post({ kind: 'ROOM', name, slug: name, floor, tags, locationId: locationId || null });
    setBusy(false);
    if (res.ok) { setName(''); router.refresh(); } else { const j = await res.json().catch(() => ({})); setMsg(j.error || 'Could not add.'); }
  }
  async function act(payload: object) { await post(payload); router.refresh(); }

  const byFloor = rooms.reduce<Record<string, Resource[]>>((acc, r) => { (acc[r.floor || '—'] ||= []).push(r); return acc; }, {});

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <h2 className="mb-1 font-[family-name:var(--font-display)] text-xl">Treatment rooms</h2>
      <p className="mb-4 text-sm text-[var(--color-stone)]">
        Named rooms, auto-assigned to each booking from whatever’s free. Tag a room <code className="text-xs">aesthetics</code> or
        <code className="text-xs"> dental</code> so the right treatments land in it (these decide booking; other tags are notes).
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-[var(--color-stone)]">Room name<br /><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Aesthetics 1" className={`${field} w-40`} /></label>
        <label className="text-xs text-[var(--color-stone)]">Floor<br /><input value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="G" className={`${field} w-16`} /></label>
        <label className="text-xs text-[var(--color-stone)]">Tags<br /><input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="aesthetics, laser" className={`${field} w-44`} /></label>
        {multiLocation && locations.length > 0 && (
          <label className="text-xs text-[var(--color-stone)]">Site<br />
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={field}>
              <option value="">All sites</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
        )}
        <button onClick={add} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-sm text-[var(--color-porcelain)] disabled:opacity-60">{busy ? '…' : 'Add room'}</button>
      </div>
      {msg && <p className="mt-2 text-sm text-[var(--color-blush)]">{msg}</p>}

      {rooms.length > 0 && (
        <div className="mt-5 space-y-4">
          {Object.entries(byFloor).map(([fl, list]) => (
            <div key={fl}>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-stone-soft)]">{fl === '—' ? 'No floor set' : `${fl} floor`}</p>
              <ul className="divide-y divide-[var(--color-line)] border-t border-[var(--color-line)]">
                {list.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className={r.active ? '' : 'opacity-50'}>
                      <span className="font-medium">{r.name}</span>
                      {r.tags.length > 0 && <span className="text-[var(--color-stone-soft)]"> · {r.tags.join(', ')}</span>}
                    </span>
                    <span className="flex items-center gap-3">
                      <button onClick={() => act({ op: 'toggle', id: r.id, active: !r.active })} className="text-xs text-[var(--color-stone)] hover:underline">{r.active ? 'Disable' : 'Enable'}</button>
                      <button onClick={() => { if (confirm('Remove this room?')) act({ op: 'remove', id: r.id }); }} className="text-xs text-[var(--color-blush)] hover:underline">Remove</button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function EquipmentSection({ equipment, locations, multiLocation }: { equipment: Resource[]; locations: Loc[]; multiLocation: boolean }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [capacity, setCapacity] = useState('1');
  const [locationId, setLocationId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function add() {
    if (!name.trim()) { setMsg('Name the equipment.'); return; }
    setBusy(true); setMsg('');
    const res = await post({ kind: 'EQUIPMENT', name, slug, capacity: Number(capacity), locationId: locationId || null });
    setBusy(false);
    if (res.ok) { setName(''); setSlug(''); setCapacity('1'); router.refresh(); } else { const j = await res.json().catch(() => ({})); setMsg(j.error || 'Could not add.'); }
  }
  async function act(payload: object) { await post(payload); router.refresh(); }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <h2 className="mb-1 font-[family-name:var(--font-display)] text-xl">Shared equipment</h2>
      <p className="mb-4 text-sm text-[var(--color-stone)]">
        Scarce machines like lasers or HIFU. The <code className="text-xs">slug</code> links to the treatments that need it
        (e.g. <code className="text-xs">laser</code>, <code className="text-xs">hifu</code>); capacity is how many you own.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-[var(--color-stone)]">Name<br /><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Laser machine" className={`${field} w-44`} /></label>
        <label className="text-xs text-[var(--color-stone)]">Slug<br /><input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="laser" className={`${field} w-28`} /></label>
        <label className="text-xs text-[var(--color-stone)]">Units<br /><input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} className={`${field} w-20`} /></label>
        {multiLocation && locations.length > 0 && (
          <label className="text-xs text-[var(--color-stone)]">Site<br />
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={field}>
              <option value="">All sites</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
        )}
        <button onClick={add} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-sm text-[var(--color-porcelain)] disabled:opacity-60">{busy ? '…' : 'Add'}</button>
      </div>
      {msg && <p className="mt-2 text-sm text-[var(--color-blush)]">{msg}</p>}

      {equipment.length > 0 && (
        <ul className="mt-5 divide-y divide-[var(--color-line)] border-t border-[var(--color-line)]">
          {equipment.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className={r.active ? '' : 'opacity-50'}>
                <span className="font-medium">{r.name}</span>
                <span className="text-[var(--color-stone-soft)]"> · {r.slug} · ×{r.capacity}</span>
              </span>
              <span className="flex items-center gap-3">
                <button onClick={() => act({ op: 'toggle', id: r.id, active: !r.active })} className="text-xs text-[var(--color-stone)] hover:underline">{r.active ? 'Disable' : 'Enable'}</button>
                <button onClick={() => { if (confirm('Remove this equipment?')) act({ op: 'remove', id: r.id }); }} className="text-xs text-[var(--color-blush)] hover:underline">Remove</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
