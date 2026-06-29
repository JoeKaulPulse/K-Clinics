'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createRoomClosure, endRoomClosureEarly, deleteRoomClosure } from '@/app/admin/schedule/actions';

export type RoomOpt = { id: string; name: string; floor: string | null };
export type ClosureRow = { id: string; roomId: string; roomName: string; startAt: string; endAt: string; reason: string | null; endedEarlyAt: string | null };

const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// BLD-198 — schedule a room block-out (contractor on site) + end it early.
export function RoomClosures({ rooms, closures }: { rooms: RoomOpt[]; closures: ClosureRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ roomId: rooms[0]?.id ?? '', start: '', end: '', reason: '' });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const now = Date.now();
  const active = closures.filter((c) => !c.endedEarlyAt && new Date(c.startAt).getTime() <= now && new Date(c.endAt).getTime() > now);
  const upcoming = closures.filter((c) => !c.endedEarlyAt && new Date(c.startAt).getTime() > now);

  function add() {
    setErr(null);
    if (!f.roomId) { setErr('Pick a room.'); return; }
    if (!f.start || !f.end) { setErr('Set a start and end.'); return; }
    start(async () => {
      const r = await createRoomClosure({ roomId: f.roomId, startISO: new Date(f.start).toISOString(), endISO: new Date(f.end).toISOString(), reason: f.reason });
      if (r.ok) { setF((p) => ({ ...p, start: '', end: '', reason: '' })); router.refresh(); } else setErr(r.error || 'Could not schedule.');
    });
  }
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { const r = await fn(); if (r.ok) router.refresh(); else setErr(r.error || 'Something went wrong.'); });

  if (rooms.length === 0) return null;
  const inp = 'rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]';

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <h2 className="font-[family-name:var(--font-display)] text-xl">Room block-outs</h2>
      <p className="mt-1 text-sm text-[var(--color-stone)]">Block a room from bookings while a contractor is on site. When it ends, the room is marked for cleaning before the next client session.</p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-xs text-[var(--color-stone)]">Room
          <select className={`${inp} mt-1 block`} value={f.roomId} onChange={(e) => set('roomId', e.target.value)}>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}{r.floor ? ` · ${r.floor}` : ''}</option>)}
          </select>
        </label>
        <label className="text-xs text-[var(--color-stone)]">From<input type="datetime-local" className={`${inp} mt-1 block`} value={f.start} onChange={(e) => set('start', e.target.value)} /></label>
        <label className="text-xs text-[var(--color-stone)]">To<input type="datetime-local" className={`${inp} mt-1 block`} value={f.end} onChange={(e) => set('end', e.target.value)} /></label>
        <label className="text-xs text-[var(--color-stone)]">Reason<input className={`${inp} mt-1 block`} placeholder="Contractor — flooring" value={f.reason} onChange={(e) => set('reason', e.target.value)} /></label>
        <button onClick={add} disabled={pending} className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-[var(--color-porcelain)] disabled:opacity-50">{pending ? 'Saving…' : 'Block out'}</button>
      </div>
      {err && <p role="alert" aria-live="assertive" className="mt-2 text-sm text-[var(--color-blush-deep)]">{err}</p>}

      {(active.length > 0 || upcoming.length > 0) && (
        <ul className="mt-5 space-y-2">
          {[...active, ...upcoming].map((c) => {
            const isActive = active.includes(c);
            return (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-4 py-2.5">
                <div className="min-w-0 text-sm">
                  <span className="font-medium">{c.roomName}</span>
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.12em] ${isActive ? 'bg-[var(--color-blush)]/25 text-[var(--color-blush-deep)]' : 'bg-[var(--color-bone)] text-[var(--color-stone)]'}`}>{isActive ? 'Blocked now' : 'Upcoming'}</span>
                  <span className="ml-2 text-[var(--color-stone)]">{fmt(c.startAt)} → {fmt(c.endAt)}{c.reason ? ` · ${c.reason}` : ''}</span>
                </div>
                <div className="flex shrink-0 gap-2">
                  {isActive
                    ? <button onClick={() => act(() => endRoomClosureEarly(c.id))} disabled={pending} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs hover:bg-[var(--color-bone)] disabled:opacity-50">End now</button>
                    : <button onClick={() => { if (confirm('Remove this scheduled block-out?')) act(() => deleteRoomClosure(c.id)); }} disabled={pending} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs text-[var(--color-blush-deep)] hover:bg-[var(--color-blush)]/20 disabled:opacity-50">Remove</button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
