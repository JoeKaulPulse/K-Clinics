'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Resource = { id: string; slug: string; name: string; kind: string; tags: string[]; floor: string | null; capacity: number; active: boolean; locationId: string | null; equipmentIds: string[] };
type Loc = { id: string; name: string };

const field = 'rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-sm';

async function post(payload: object) {
  return fetch('/api/admin/resources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

/** Owner/admin-only: treatment rooms (named, auto-assigned), shared equipment
 *  (laser/HIFU), each room's purpose, and which equipment sits in each room —
 *  all editable over time. */
export function ResourcesManager({ resources, locations, multiLocation }: { resources: Resource[]; locations: Loc[]; multiLocation: boolean }) {
  const rooms = resources.filter((r) => r.kind === 'ROOM');
  const equipment = resources.filter((r) => r.kind === 'EQUIPMENT');
  return (
    <>
      <RoomSection rooms={rooms} equipment={equipment} locations={locations} multiLocation={multiLocation} />
      <EquipmentSection equipment={equipment} locations={locations} multiLocation={multiLocation} />
    </>
  );
}

function RoomSection({ rooms, equipment, locations, multiLocation }: { rooms: Resource[]; equipment: Resource[]; locations: Loc[]; multiLocation: boolean }) {
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

  const byFloor = rooms.reduce<Record<string, Resource[]>>((acc, r) => { (acc[r.floor || '—'] ||= []).push(r); return acc; }, {});

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <h2 className="mb-1 font-[family-name:var(--font-display)] text-xl">Treatment rooms</h2>
      <p className="mb-4 text-sm text-[var(--color-stone)]">
        Named rooms, auto-assigned to each booking from whatever’s free. Edit a room to change its purpose
        (tags <code className="text-xs">aesthetics</code> / <code className="text-xs">dental</code> decide which treatments land in it)
        or what equipment lives in it — both can change over time.
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
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-stone)]">{fl === '—' ? 'No floor set' : `${fl} floor`}</p>
              <ul className="divide-y divide-[var(--color-line)] border-t border-[var(--color-line)]">
                {list.map((r) => <RoomRow key={r.id} room={r} equipment={equipment} />)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RoomRow({ room, equipment }: { room: Resource; equipment: Resource[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState(room.tags.join(', '));
  const [equip, setEquip] = useState<Set<string>>(new Set(room.equipmentIds));
  const [msg, setMsg] = useState('');

  const equipNames = equipment.filter((e) => room.equipmentIds.includes(e.id)).map((e) => e.name);

  async function act(payload: object) { await post(payload); router.refresh(); }

  async function saveTags() {
    setMsg('Saving…');
    const res = await post({ op: 'setTags', id: room.id, tags });
    setMsg(res.ok ? 'Saved ✓' : 'Could not save'); router.refresh();
  }
  async function toggleEquip(id: string) {
    const next = new Set(equip);
    next.has(id) ? next.delete(id) : next.add(id);
    setEquip(next);
    await post({ op: 'setEquipment', id: room.id, equipmentIds: [...next] });
    router.refresh();
  }

  return (
    <li className="py-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className={room.active ? '' : 'opacity-50'}>
          <span className="font-medium">{room.name}</span>
          {room.tags.length > 0 && <span className="text-[var(--color-stone)]"> · {room.tags.join(', ')}</span>}
          {equipNames.length > 0 && <span className="text-[var(--color-stone)]"> · 🛠 {equipNames.join(', ')}</span>}
        </span>
        <span className="flex items-center gap-3">
          <button onClick={() => setOpen((v) => !v)} className="text-xs text-[var(--color-gold)] hover:underline">{open ? 'Close' : 'Edit'}</button>
          <button onClick={() => act({ op: 'toggle', id: room.id, active: !room.active })} className="text-xs text-[var(--color-stone)] hover:underline">{room.active ? 'Disable' : 'Enable'}</button>
          <button onClick={() => { if (confirm('Remove this room?')) act({ op: 'remove', id: room.id }); }} className="text-xs text-[var(--color-blush)] hover:underline">Remove</button>
        </span>
      </div>

      {open && (
        <div className="mt-3 space-y-3 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white/60 p-3">
          <div>
            <p className="mb-1 text-xs font-medium text-[var(--color-stone)]">Used for (tags)</p>
            <div className="flex items-center gap-2">
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="aesthetics, laser" className={`${field} w-64`} />
              <button onClick={saveTags} className="rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs text-[var(--color-porcelain)]">Save</button>
              {msg && <span className="text-xs text-[var(--color-stone)]">{msg}</span>}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-[var(--color-stone)]">Equipment in this room</p>
            {equipment.length === 0 ? (
              <p className="text-xs text-[var(--color-stone)]">No equipment defined yet — add some below.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {equipment.map((e) => (
                  <label key={e.id} className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={equip.has(e.id)} onChange={() => toggleEquip(e.id)} className="h-3.5 w-3.5 accent-[var(--color-gold)]" />
                    {e.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </li>
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
        Assign machines to rooms above.
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
                <span className="text-[var(--color-stone)]"> · {r.slug} · ×{r.capacity}</span>
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
