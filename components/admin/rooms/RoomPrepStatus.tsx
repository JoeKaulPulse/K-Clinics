'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoomDay, RoomPrepState } from '@/lib/room-prep';
import { RoomAvailabilityBoard } from './RoomAvailabilityBoard';

// PRJ-63.8 — live room availability + prep board. Polls the prep API so a
// receptionist marking a room READY surfaces to the clinician within seconds
// (reusing the lightweight poll pattern, not new SSE infra). Optimistically
// reflects the staff member's own changes, then reconciles on the next poll.
export function RoomPrepStatus({
  initialRooms = [],
  initialCanManage = false,
  locationId,
  pollMs = 20000,
}: {
  initialRooms?: RoomDay[];
  initialCanManage?: boolean;
  locationId?: string | null;
  pollMs?: number;
}) {
  const [rooms, setRooms] = useState<RoomDay[]>(initialRooms);
  const [canManage, setCanManage] = useState(initialCanManage);
  const [busyId, setBusyId] = useState<string | null>(null);
  const live = useRef(true);

  const qs = locationId ? `?locationId=${encodeURIComponent(locationId)}` : '';

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/rooms/prep${qs}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (live.current && data?.ok) {
        setRooms(data.rooms as RoomDay[]);
        setCanManage(!!data.canManage);
      }
    } catch { /* transient — keep last good state */ }
  }, [qs]);

  useEffect(() => {
    live.current = true;
    if (initialRooms.length === 0) refresh();
    const id = setInterval(refresh, pollMs);
    const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { live.current = false; clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, pollMs]);

  const onSet = useCallback(async (roomId: string, status: RoomPrepState) => {
    setBusyId(roomId);
    setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, prep: status } : r))); // optimistic
    try {
      await fetch('/api/admin/rooms/prep', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, status }),
      });
      await refresh();
    } catch { /* next poll reconciles */ }
    finally { if (live.current) setBusyId(null); }
  }, [refresh]);

  const onOccupy = useCallback(async (roomId: string, occupied: boolean) => {
    setBusyId(roomId);
    setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, occupiedManual: occupied } : r))); // optimistic
    try {
      await fetch('/api/admin/rooms/prep', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, occupied }),
      });
      await refresh();
    } catch { /* next poll reconciles */ }
    finally { if (live.current) setBusyId(null); }
  }, [refresh]);

  return <RoomAvailabilityBoard rooms={rooms} canManage={canManage} busyId={busyId} onSet={onSet} onOccupy={onOccupy} />;
}
