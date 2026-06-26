'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveDevice, setDeviceActive, deleteDevice } from '@/app/admin/devices/actions';

export type DeviceRow = {
  id: string; name: string; kind: string; provider: string | null; externalId: string | null;
  location: string | null; station: string | null; active: boolean; lastSeenAt: string | null; notes: string | null;
  roomId: string | null; token: string | null;
};
export type RoomOpt = { id: string; name: string };

const KINDS = [
  { value: 'TERMINAL', label: 'Card terminal' }, { value: 'DISPLAY', label: 'Display screen' },
  { value: 'KIOSK', label: 'Sign-in kiosk' }, { value: 'SCANNER', label: 'Barcode scanner' },
  { value: 'PRINTER', label: 'Printer' }, { value: 'OTHER', label: 'Other' },
];
const kindLabel = (k: string) => KINDS.find((x) => x.value === k)?.label ?? k;
const f = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]';
const blank = { id: undefined as string | undefined, name: '', kind: 'TERMINAL', provider: '', externalId: '', location: '', station: '', notes: '', roomId: '' };

export function DeviceManager({ devices, providers, rooms = [] }: { devices: DeviceRow[]; providers: { id: string; label: string }[]; rooms?: RoomOpt[] }) {
  const router = useRouter();
  const [form, setForm] = useState<typeof blank | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof blank>(k: K, v: (typeof blank)[K]) => setForm((p) => (p ? { ...p, [k]: v } : p));

  function edit(d: DeviceRow) {
    setError(null);
    setForm({ id: d.id, name: d.name, kind: d.kind, provider: d.provider ?? '', externalId: d.externalId ?? '', location: d.location ?? '', station: d.station ?? '', notes: d.notes ?? '', roomId: d.roomId ?? '' });
  }
  function save() {
    if (!form) return;
    setError(null);
    if (!form.name.trim()) { setError('Give the device a name.'); return; }
    start(async () => {
      const r = await saveDevice(form);
      if (r.ok) { setForm(null); router.refresh(); } else setError(r.error || 'Could not save.');
    });
  }
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { const r = await fn(); if (r.ok) router.refresh(); else setError(r.error || 'Something went wrong.'); });

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        {!form && <button onClick={() => { setError(null); setForm({ ...blank }); }} className="rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm font-medium text-[var(--color-porcelain)]">Add a device</button>}
      </div>

      {form && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
          <h2 className="font-[family-name:var(--font-display)] text-xl">{form.id ? 'Edit device' : 'New device'}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-[var(--color-stone)]">Name<input className={`${f} mt-1`} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Reception terminal" /></label>
            <label className="text-xs text-[var(--color-stone)]">Type
              <select className={`${f} mt-1`} value={form.kind} onChange={(e) => set('kind', e.target.value)}>{KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
            </label>
            {form.kind === 'TERMINAL' && (<>
              <label className="text-xs text-[var(--color-stone)]">Terminal provider
                <select className={`${f} mt-1`} value={form.provider} onChange={(e) => set('provider', e.target.value)}>
                  <option value="">—</option>
                  {providers.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </label>
              <label className="text-xs text-[var(--color-stone)]">Provider device ID<input className={`${f} mt-1`} value={form.externalId} onChange={(e) => set('externalId', e.target.value)} placeholder="POI / terminal id" /></label>
            </>)}
            {form.kind === 'DISPLAY' && (
              <label className="text-xs text-[var(--color-stone)] sm:col-span-2">Treatment room (for a room-status display)
                <select className={`${f} mt-1`} value={form.roomId} onChange={(e) => set('roomId', e.target.value)}>
                  <option value="">— not a room display —</option>
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </label>
            )}
            <label className="text-xs text-[var(--color-stone)]">Location<input className={`${f} mt-1`} value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Reception" /></label>
            <label className="text-xs text-[var(--color-stone)]">Station
              <select className={`${f} mt-1`} value={form.station} onChange={(e) => set('station', e.target.value)}>
                <option value="">—</option><option value="reception">Reception</option><option value="room">Room</option>
              </select>
            </label>
            <label className="text-xs text-[var(--color-stone)] sm:col-span-2">Notes<input className={`${f} mt-1`} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></label>
          </div>
          {error && <p role="alert" aria-live="assertive" className="mt-3 rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-3 py-2 text-sm">{error}</p>}
          <div className="mt-4 flex justify-end gap-3">
            <button onClick={() => { setForm(null); setError(null); }} className="px-4 py-2 text-sm text-[var(--color-stone)]">Cancel</button>
            <button onClick={save} disabled={pending} className="rounded-full bg-[var(--color-gold)] px-5 py-2 text-sm font-medium text-white disabled:opacity-50">{pending ? 'Saving…' : 'Save device'}</button>
          </div>
        </div>
      )}

      {devices.length === 0 && !form && <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] p-8 text-center text-sm text-[var(--color-stone)]">No devices registered yet.</p>}

      <ul className="space-y-2">
        {devices.map((d) => (
          <li key={d.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 py-3 ${d.active ? '' : 'opacity-55'}`}>
            <div className="min-w-0">
              <p className="font-medium">{d.name} {!d.active && <span className="text-xs text-[var(--color-stone)]">· inactive</span>}</p>
              <p className="mt-0.5 text-xs text-[var(--color-stone)]">
                {kindLabel(d.kind)}
                {d.provider ? ` · ${providers.find((p) => p.id === d.provider)?.label ?? d.provider}` : ''}
                {d.externalId ? ` · ${d.externalId}` : ''}
                {d.location ? ` · ${d.location}` : ''}
                {d.station ? ` · ${d.station}` : ''}
                {d.kind === 'DISPLAY' && d.roomId ? ` · ${rooms.find((r) => r.id === d.roomId)?.name ?? 'room'}` : ''}
              </p>
              {d.kind === 'DISPLAY' && d.token && (
                <p className="mt-1 text-xs text-[var(--color-stone)]">Point the screen at <a href={`/room-display/${d.token}`} target="_blank" rel="noreferrer" className="break-all text-[var(--color-gold)] underline">/room-display/{d.token}</a></p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button onClick={() => edit(d)} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs hover:bg-[var(--color-bone)]">Edit</button>
              <button onClick={() => act(() => setDeviceActive(d.id, !d.active))} disabled={pending} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs hover:bg-[var(--color-bone)] disabled:opacity-50">{d.active ? 'Deactivate' : 'Activate'}</button>
              <button onClick={() => { if (confirm(`Delete “${d.name}”?`)) act(() => deleteDevice(d.id)); }} disabled={pending} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs text-[var(--color-blush-deep)] hover:bg-[var(--color-blush)]/20 disabled:opacity-50">Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
