import type { RoomDay, RoomPrepState } from '@/lib/room-prep';
import { EmptyWidget } from '@/components/admin/dashboard/Widgets';

// PRJ-63.8 — presentational room grid (no hooks; client-safe). Each card shows
// the room, its live availability (occupied now / next / free), and its prep
// state. When `canManage`, the prep state is a DIRTY→CLEANING→READY control;
// otherwise it's a read-only badge. State + polling live in <RoomPrepStatus>.

const PREP: Record<RoomPrepState, { label: string; cls: string; dot: string }> = {
  READY: { label: 'Ready', cls: 'border-[var(--color-jade)]/40 bg-[color-mix(in_oklab,var(--color-jade)_12%,transparent)] text-[var(--color-jade)]', dot: 'bg-[var(--color-jade)]' },
  CLEANING: { label: 'Cleaning', cls: 'border-[var(--color-gold)]/50 bg-[color-mix(in_oklab,var(--color-gold)_14%,transparent)] text-[var(--color-gold-deep)]', dot: 'bg-[var(--color-gold)]' },
  DIRTY: { label: 'Needs clean', cls: 'border-[#c0392b]/30 bg-[color-mix(in_oklab,#c0392b_10%,transparent)] text-[#b23b3b]', dot: 'bg-[#c0392b]' },
};
// Occupancy takes visual priority over cleanliness on the badge — at a glance the
// question is "can I use this room?", and an occupied room can't be used (BLD-506).
const OCCUPIED_BADGE = { label: 'Occupied', cls: 'border-[#b23b3b]/40 bg-[color-mix(in_oklab,#c0392b_12%,transparent)] text-[#b23b3b]', dot: 'bg-[#c0392b]' };
const ORDER: RoomPrepState[] = ['DIRTY', 'CLEANING', 'READY'];

export function RoomAvailabilityBoard({
  rooms,
  canManage = false,
  busyId = null,
  onSet,
  onOccupy,
}: {
  rooms: RoomDay[];
  canManage?: boolean;
  busyId?: string | null;
  onSet?: (roomId: string, status: RoomPrepState) => void;
  onOccupy?: (roomId: string, occupied: boolean) => void;
}) {
  if (rooms.length === 0) {
    return <EmptyWidget title="No treatment rooms" hint="Add rooms under Resources to track availability and prep here." />;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rooms.map((room) => {
        const occupied = room.occupiedNow || room.occupiedManual;
        const badge = occupied ? OCCUPIED_BADGE : PREP[room.prep];
        return (
          <div key={room.id} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)]/30 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-[var(--color-ink)]">{room.name}</p>
                <p className="mt-0.5 text-xs text-[var(--color-stone)]">{room.floor ? `Floor ${room.floor}` : 'Room'}</p>
              </div>
              <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${badge.cls}`}>
                <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                {badge.label}
              </span>
            </div>

            <div className="mt-3 text-sm">
              {room.occupiedNow && room.current ? (
                <p className="text-[var(--color-ink-soft)]">
                  <span className="font-medium text-[#b23b3b]">In use</span> · {room.current.treatment}
                  <span className="text-[var(--color-stone)]"> · {room.current.client}</span>
                </p>
              ) : room.occupiedManual ? (
                <p className="text-[var(--color-ink-soft)]">
                  <span className="font-medium text-[#b23b3b]">Occupied</span>
                  {room.occupiedBy && <span className="text-[var(--color-stone)]"> · marked by {room.occupiedBy}</span>}
                </p>
              ) : room.next ? (
                <p className="text-[var(--color-ink-soft)]">
                  <span className="font-medium text-[var(--color-jade)]">Free</span>
                  <span className="text-[var(--color-stone)]"> · next at {room.next.timeLabel} ({room.next.treatment})</span>
                </p>
              ) : (
                <p className="text-[var(--color-stone)]"><span className="font-medium text-[var(--color-jade)]">Free</span> · nothing else booked today</p>
              )}
            </div>

            {canManage ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div role="group" aria-label={`${room.name} prep state`} className="inline-flex rounded-full border border-[var(--color-line)] bg-[var(--color-porcelain)] p-0.5">
                  {ORDER.map((s) => {
                    const on = room.prep === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => onSet?.(room.id, s)}
                        aria-pressed={on}
                        disabled={busyId === room.id}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)] ${
                          on ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'text-[var(--color-stone)] hover:text-[var(--color-ink)]'
                        }`}
                      >
                        {PREP[s].label}
                      </button>
                    );
                  })}
                </div>
                {/* Manual occupancy (BLD-506): who is in the room now. */}
                <div role="group" aria-label={`${room.name} occupancy`} className="inline-flex rounded-full border border-[var(--color-line)] bg-[var(--color-porcelain)] p-0.5">
                  <button
                    type="button"
                    onClick={() => onOccupy?.(room.id, true)}
                    aria-pressed={room.occupiedManual}
                    disabled={busyId === room.id}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)] ${
                      room.occupiedManual ? 'bg-[#b23b3b] text-white' : 'text-[var(--color-stone)] hover:text-[var(--color-ink)]'
                    }`}
                  >
                    Occupied
                  </button>
                  <button
                    type="button"
                    onClick={() => onOccupy?.(room.id, false)}
                    aria-pressed={!room.occupiedManual}
                    disabled={busyId === room.id}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)] ${
                      !room.occupiedManual ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'text-[var(--color-stone)] hover:text-[var(--color-ink)]'
                    }`}
                  >
                    Vacant
                  </button>
                </div>
              </div>
            ) : (
              room.cleanedBy && room.prep === 'READY' && <p className="mt-2 text-xs text-[var(--color-stone)]">Set ready by {room.cleanedBy}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
