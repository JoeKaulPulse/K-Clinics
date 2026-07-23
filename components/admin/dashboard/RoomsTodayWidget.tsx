import { getRoomsForDay } from '@/lib/room-prep';
import { RoomPrepStatus } from '@/components/admin/rooms/RoomPrepStatus';

// "Rooms today" — live availability + prep handoff (BLD-1002). Independent of
// both the dashboard's parallel query batch and the next-arrival chain, so it
// streams in through its own <Suspense> boundary rather than blocking the
// page shell. Query is unchanged from the original inline version in
// app/admin/page.tsx.
export async function RoomsTodayWidget({ canRoomsPrep }: { canRoomsPrep: boolean }) {
  const roomsToday = canRoomsPrep ? await getRoomsForDay().catch(() => []) : [];
  if (!canRoomsPrep || roomsToday.length === 0) return null;
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Rooms today</h2>
        <span className="text-xs text-[var(--color-stone)]">Tap a room to set its readiness · updates live</span>
      </div>
      <RoomPrepStatus initialRooms={roomsToday} initialCanManage={canRoomsPrep} />
    </section>
  );
}
