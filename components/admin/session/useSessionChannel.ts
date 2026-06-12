'use client';

import { useLiveChannel } from '@/hooks/useLiveChannel';
import type { SessionSnapshot } from '@/lib/appointment-session-server';

// BLD-138 v2 — live channel for the staff session runner.
// BLD-145: generic SSE+poll pattern extracted to hooks/useLiveChannel;
// this wrapper supplies the session-specific URL and poll endpoint.

export function useSessionChannel(bookingId: string) {
  const sseUrl = `/api/admin/bookings/session/stream?bookingId=${encodeURIComponent(bookingId)}`;

  const { snapshot, mode } = useLiveChannel<SessionSnapshot>(
    sseUrl,
    async () => {
      const res = await fetch('/api/admin/bookings/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'status', bookingId }),
      });
      const j = await res.json().catch(() => null) as { ok?: boolean; snapshot?: SessionSnapshot } | null;
      return j?.ok && j.snapshot ? j.snapshot : null;
    },
    (s) => s.rev,
    { pollMs: 2000, errorThreshold: 3 },
  );

  return { snapshot, mode };
}
