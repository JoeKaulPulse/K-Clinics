'use client';

import { useEffect, useRef, useState } from 'react';
import type { SessionSnapshot } from '@/lib/appointment-session-server';

// BLD-138 v2 — live channel for the staff session runner. Primary transport is
// SSE (auto-reconnecting short-lived stream); two consecutive failures without
// a successful open drop to a 2s poll of the op:status endpoint. Snapshots are
// deduped by rev so devices re-render only on real change.
const POLL_MS = 2000;

export function useSessionChannel(bookingId: string) {
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [mode, setMode] = useState<'sse' | 'poll'>('sse');
  const lastRev = useRef('');

  useEffect(() => {
    let stopped = false;
    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let errorsSinceOpen = 0;

    const apply = (snap: SessionSnapshot | null) => {
      if (stopped || !snap || snap.rev === lastRev.current) return;
      lastRev.current = snap.rev;
      setSnapshot(snap);
    };

    const startPolling = () => {
      if (stopped || pollTimer) return;
      setMode('poll');
      const tick = async () => {
        try {
          const res = await fetch('/api/admin/bookings/session', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ op: 'status', bookingId }),
          });
          const j = await res.json().catch(() => null);
          if (j?.ok && j.snapshot) apply(j.snapshot);
        } catch { /* transient — next tick retries */ }
      };
      tick();
      pollTimer = setInterval(tick, POLL_MS);
    };

    const startSse = () => {
      if (stopped) return;
      es = new EventSource(`/api/admin/bookings/session/stream?bookingId=${encodeURIComponent(bookingId)}`);
      es.onopen = () => { errorsSinceOpen = 0; setMode('sse'); };
      es.onmessage = (e) => {
        try { apply(JSON.parse(e.data)); } catch { /* ignore malformed frame */ }
      };
      es.onerror = () => {
        errorsSinceOpen += 1;
        // Routine 55s closes auto-reconnect; only persistent failure falls back.
        if (errorsSinceOpen >= 3 || es?.readyState === EventSource.CLOSED) {
          es?.close();
          es = null;
          startPolling();
        }
      };
    };

    startSse();
    return () => {
      stopped = true;
      es?.close();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [bookingId]);

  return { snapshot, mode };
}
