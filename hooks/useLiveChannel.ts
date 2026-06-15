'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * BLD-145 — generic SSE + polling live channel hook.
 *
 * Primary transport: EventSource on `sseUrl` (auto-reconnects after each
 * ~55s server close). Falls back to `pollFn` polling after `errorThreshold`
 * consecutive errors or a fatal CLOSED state.
 *
 * `dedupKey` extracts a stable equality key from a snapshot so devices only
 * re-render on real change. `pollFn` and `dedupKey` are captured via refs so
 * callers do not need to memoize them.
 */
export function useLiveChannel<T>(
  sseUrl: string,
  pollFn: () => Promise<T | null>,
  dedupKey: (snap: T) => string,
  { pollMs = 2000, errorThreshold = 3 }: { pollMs?: number; errorThreshold?: number } = {},
): { snapshot: T | null; mode: 'sse' | 'poll' } {
  const [snapshot, setSnapshot] = useState<T | null>(null);
  const [mode, setMode] = useState<'sse' | 'poll'>('sse');
  const lastKey = useRef('');
  const pollRef = useRef(pollFn);
  const keyRef = useRef(dedupKey);
  pollRef.current = pollFn;
  keyRef.current = dedupKey;

  useEffect(() => {
    let stopped = false;
    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let errors = 0;

    const apply = (snap: T | null) => {
      if (stopped || !snap) return;
      const k = keyRef.current(snap);
      if (k === lastKey.current) return;
      lastKey.current = k;
      setSnapshot(snap);
    };

    const startPolling = () => {
      if (stopped || pollTimer) return;
      setMode('poll');
      const tick = async () => {
        try { apply(await pollRef.current()); } catch { /* network blip — next tick retries */ }
      };
      void tick();
      pollTimer = setInterval(tick, pollMs);
    };

    const startSse = () => {
      if (stopped) return;
      es = new EventSource(sseUrl);
      es.onopen = () => { errors = 0; setMode('sse'); };
      es.onmessage = (e) => {
        try { apply(JSON.parse(e.data) as T); } catch { /* malformed frame — ignore */ }
      };
      es.onerror = () => {
        errors += 1;
        if (errors >= errorThreshold || es?.readyState === EventSource.CLOSED) {
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
  }, [sseUrl, pollMs, errorThreshold]);

  return { snapshot, mode };
}
