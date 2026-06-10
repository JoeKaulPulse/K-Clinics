import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// BLD-138 v2 — staff SSE channel for the live appointment session. Every open
// device (front desk, host iPad, clinician, checkout) receives the same
// snapshot stream and reconciles instantly — no refreshes between handoffs.
// Pattern mirrors the kiosk stream: short-lived function (~55s), retry: 1000
// so EventSource reconnects seamlessly, heartbeat comments to keep proxies
// alive. Each tick runs a 3-read change probe; the full snapshot is built and
// pushed only when the probe moves. Transient DB errors skip a tick rather
// than ending the stream.
const POLL_MS = 750;
const HEARTBEAT_MS = 15_000;
const LIFETIME_MS = 55_000;

export async function GET(req: Request) {
  if (!crmEnabled) return new Response('disabled', { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('bookings.manage');
  if (!session) return new Response('forbidden', { status: 403 });

  const bookingId = new URL(req.url).searchParams.get('bookingId') || '';
  if (!bookingId) return new Response('missing bookingId', { status: 400 });

  const { sessionSnapshot, sessionProbe } = await import('@/lib/appointment-session-server');

  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(text)); } catch { closed = true; }
      };
      send('retry: 1000\n\n');

      let lastProbe = '__init__';
      let lastBeat = Date.now();
      const startedAt = Date.now();
      const abort = () => { closed = true; };
      req.signal.addEventListener('abort', abort);

      while (!closed && Date.now() - startedAt < LIFETIME_MS) {
        try {
          const probe = await sessionProbe(bookingId);
          if (probe === null) { send('event: gone\ndata: {}\n\n'); break; }
          if (probe !== lastProbe) {
            const snap = await sessionSnapshot(bookingId);
            if (!snap) { send('event: gone\ndata: {}\n\n'); break; }
            lastProbe = probe;
            send(`data: ${JSON.stringify(snap)}\n\n`);
            lastBeat = Date.now();
          } else if (Date.now() - lastBeat > HEARTBEAT_MS) {
            send(': hb\n\n');
            lastBeat = Date.now();
          }
        } catch { /* transient DB error — skip this tick, keep the stream */ }
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
      req.signal.removeEventListener('abort', abort);
      try { controller.close(); } catch { /* already closed */ }
    },
    cancel() { closed = true; },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}
