'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Countdown } from '@/components/admin/DashboardLive';
import type { RoomPrepState } from '@/lib/room-prep';

export type NextArrival = {
  id: string;
  clientName: string;
  clientId: string;
  treatment: string;
  startIso: string;
  timeLabel: string;
  practitioner?: string | null;
  room?: string | null;
  /** When known, the room checklist item reflects + sets the live prep state. */
  roomId?: string | null;
  roomPrep?: RoomPrepState;
  /** Whether this user may set room readiness (rooms.prep.manage). */
  canManageRoom?: boolean;
  drinks: string[];
  allergies?: string | null;
  medicalFlag?: string | null;
};

// "Up next — prepare for arrival": the single most useful thing for front-of-house
// at the start of (and through) the day. Live countdown + a tappable prep
// checklist tailored to this client (room, their drink preference, cleaning,
// welcome screen). Checklist state is local/ephemeral — a satisfying per-arrival
// ritual, not a record to persist.
export function ArrivalPrep({ a }: { a: NextArrival }) {
  // The room row is backed by the shared RoomPrep service when we know the room:
  // tapping it sets READY (or back to DIRTY) and surfaces live to the clinician.
  // The remaining rows stay local/ephemeral — a per-arrival ritual, not a record.
  const liveRoom = !!(a.roomId && a.canManageRoom);
  const [roomPrep, setRoomPrep] = useState<RoomPrepState>(a.roomPrep ?? 'DIRTY');
  const [roomBusy, setRoomBusy] = useState(false);
  const roomLabel = a.room
    ? roomPrep === 'READY' ? `Room ready — ${a.room}` : roomPrep === 'CLEANING' ? `Room being cleaned — ${a.room}` : `Mark room ready — ${a.room}`
    : 'Treatment room cleaned & set up';
  const prep = [
    { key: 'room', label: roomLabel },
    { key: 'drinks', label: a.drinks.length ? `Prepare drinks — ${a.drinks.join(', ')}` : 'Offer a drink — water, tea or coffee' },
    { key: 'notes', label: 'Review client notes & today’s treatment' },
    { key: 'welcome', label: 'Personalise the welcome screen', soon: true },
  ];
  const [done, setDone] = useState<Set<string>>(new Set());
  const toggle = (k: string) => setDone((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  async function setRoom(next: RoomPrepState) {
    if (!a.roomId || roomBusy) return;
    setRoomBusy(true);
    const prevState = roomPrep;
    setRoomPrep(next); // optimistic
    try {
      const res = await fetch('/api/admin/rooms/prep', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: a.roomId, status: next }),
      });
      if (!res.ok) setRoomPrep(prevState);
    } catch { setRoomPrep(prevState); }
    finally { setRoomBusy(false); }
  }

  const isChecked = (k: string) => (k === 'room' && liveRoom ? roomPrep === 'READY' : done.has(k));
  const readyCount = prep.filter((p) => !p.soon && isChecked(p.key)).length;
  const total = prep.filter((p) => !p.soon).length;

  return (
    <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-gold)]/40 bg-[var(--color-porcelain)]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[var(--color-line)] bg-[var(--color-bone)]/60 px-5 py-3">
        <p className="eyebrow text-[var(--color-stone)]">Up next · prepare for arrival</p>
        <p className="text-sm font-medium"><span className="tabular-nums">{a.timeLabel}</span> · <Countdown iso={a.startIso} /></p>
      </div>

      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/admin/clients/${a.clientId}`} className="font-[family-name:var(--font-display)] text-xl hover:text-[var(--color-gold-deep)]">{a.clientName}</Link>
            <p className="mt-0.5 text-sm text-[var(--color-stone)]">{a.treatment}{a.practitioner ? ` · with ${a.practitioner}` : ''}</p>
          </div>
          <Link href={`/admin/bookings/${a.id}`} className="shrink-0 rounded-full border border-[var(--color-line)] px-3.5 py-1.5 text-sm transition-colors hover:bg-[var(--color-bone)]">Open booking →</Link>
        </div>

        {(a.medicalFlag || a.allergies) && (
          <p className="mt-3 flex items-start gap-2 rounded-[var(--radius-sm)] bg-[color-mix(in_oklab,#c0392b_12%,transparent)] px-3 py-2 text-sm text-[var(--color-ink)]">
            <span aria-hidden>⚠</span>
            <span className="min-w-0 break-words">{[a.medicalFlag, a.allergies && `Allergies: ${a.allergies}`].filter(Boolean).join(' · ')}</span>
          </p>
        )}

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-stone)]">Prep checklist</p>
            <span className="text-xs tabular-nums text-[var(--color-stone)]">{readyCount}/{total} ready</span>
          </div>
          <ul className="space-y-1.5">
            {prep.map((p) => {
              const checked = isChecked(p.key);
              const isLiveRoom = p.key === 'room' && liveRoom;
              const disabled = p.soon || (isLiveRoom && roomBusy);
              const onClick = () => {
                if (p.soon) return;
                if (isLiveRoom) setRoom(roomPrep === 'READY' ? 'DIRTY' : 'READY');
                else toggle(p.key);
              };
              return (
                <li key={p.key}>
                  <button
                    type="button"
                    onClick={onClick}
                    disabled={disabled}
                    aria-pressed={checked}
                    className={`flex w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-left text-sm transition-colors ${p.soon ? 'cursor-default opacity-60' : 'hover:bg-[var(--color-bone)]'} ${isLiveRoom && roomBusy ? 'opacity-60' : ''}`}
                  >
                    <span aria-hidden className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors ${checked ? 'border-[var(--color-gold)] bg-[var(--color-gold)] text-white' : 'border-[var(--color-sand)]'}`}>
                      {checked && <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6.2 4.8 9 10 3.4" /></svg>}
                    </span>
                    <span className={`min-w-0 break-words ${checked ? 'text-[var(--color-stone)] line-through' : 'text-[var(--color-ink-soft)]'}`}>{p.label}</span>
                    {isLiveRoom && <span className="ml-auto shrink-0 rounded-full bg-[var(--color-bone)] px-2 py-0.5 text-[0.6rem] uppercase tracking-wide text-[var(--color-stone)]">Live</span>}
                    {p.soon && <span className="ml-auto shrink-0 rounded-full bg-[var(--color-bone)] px-2 py-0.5 text-[0.6rem] uppercase tracking-wide text-[var(--color-stone)]">Soon</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
