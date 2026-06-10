import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// BLD-138 v2 — client SSE channel for the phone companion page. Token-authed
// (booking manageToken); streams only the sanitised client view. Same
// short-lived reconnecting pattern as the staff/kiosk streams: probe-first
// polling, transient errors skip a tick, cancel stops the loop.
const POLL_MS = 1000;
const HEARTBEAT_MS = 15_000;
const LIFETIME_MS = 55_000;

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!crmEnabled) return new Response('disabled', { status: 503 });
  const { token } = await params;
  const { db } = await import('@/lib/db');
  const b = await db.booking.findUnique({ where: { manageToken: token }, select: { id: true } });
  if (!b) return new Response('not found', { status: 404 });

  const { sessionSnapshot, sessionProbe, clientView } = await import('@/lib/appointment-session-server');
  const bookingId = b.id;

  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(text)); } catch { closed = true; }
      };
      send('retry: 1200\n\n');

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
            send(`data: ${JSON.stringify(clientView(snap))}\n\n`);
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
