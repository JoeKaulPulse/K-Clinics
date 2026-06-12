/**
 * BLD-145 — shared server-side SSE stream builder.
 *
 * Owns the loop / heartbeat / lifetime / abort / cancel / error policy so each
 * stream route only supplies its load + probe logic and constants. All three
 * hardened patterns (cancel handler, safe send, transient-error tolerance,
 * probe-first polling) are baked in here.
 */

export const SSE_HEADERS: HeadersInit = {
  'content-type': 'text/event-stream; charset=utf-8',
  'cache-control': 'no-cache, no-transform',
  connection: 'keep-alive',
  'x-accel-buffering': 'no',
};

interface SseSnapshotOpts<T> {
  /** Full snapshot loader. null → emit event:gone and close. */
  load: () => Promise<T | null>;
  /**
   * Optional cheap change probe. Return a hash/rev string or null.
   * null → emit event:gone and close; unchanged string → skip load.
   * Omit to fall back to full-JSON comparison of load() output.
   */
  probe?: () => Promise<string | null>;
  pollMs?: number;       // default 1000
  heartbeatMs?: number;  // default 15_000
  lifetimeMs?: number;   // default 55_000
  retryMs?: number;      // default 1000 — sent as the SSE `retry:` directive
  signal: AbortSignal;
}

export function sseSnapshotStream<T>(opts: SseSnapshotOpts<T>): ReadableStream<Uint8Array> {
  const {
    load, probe,
    pollMs = 1000,
    heartbeatMs = 15_000,
    lifetimeMs = 55_000,
    retryMs = 1000,
    signal,
  } = opts;

  const encoder = new TextEncoder();
  let closed = false;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(text)); } catch { closed = true; }
      };
      const onAbort = () => { closed = true; };
      signal.addEventListener('abort', onAbort);
      send(`retry: ${retryMs}\n\n`);

      let lastKey = '__init__';
      let lastBeat = Date.now();
      const startedAt = Date.now();

      while (!closed && Date.now() - startedAt < lifetimeMs) {
        try {
          if (probe) {
            const key = await probe();
            if (key === null) { send('event: gone\ndata: {}\n\n'); break; }
            if (key !== lastKey) {
              const snap = await load();
              if (!snap) { send('event: gone\ndata: {}\n\n'); break; }
              lastKey = key;
              send(`data: ${JSON.stringify(snap)}\n\n`);
              lastBeat = Date.now();
            } else if (Date.now() - lastBeat > heartbeatMs) {
              send(': hb\n\n');
              lastBeat = Date.now();
            }
          } else {
            const snap = await load();
            if (!snap) { send('event: gone\ndata: {}\n\n'); break; }
            const json = JSON.stringify(snap);
            if (json !== lastKey) {
              send(`data: ${json}\n\n`);
              lastKey = json;
              lastBeat = Date.now();
            } else if (Date.now() - lastBeat > heartbeatMs) {
              send(': hb\n\n');
              lastBeat = Date.now();
            }
          }
        } catch { /* transient error — skip this tick, keep the stream */ }
        await new Promise<void>((r) => setTimeout(r, pollMs));
      }

      signal.removeEventListener('abort', onAbort);
      try { controller.close(); } catch { /* already closed */ }
    },
    cancel() { closed = true; },
  });
}
