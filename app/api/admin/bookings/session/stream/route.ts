import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// BLD-138 v2 — staff SSE channel for the live appointment session. Every open
// device (front desk, host iPad, clinician, checkout) receives the same
// snapshot stream and reconciles instantly — no refreshes between handoffs.
// Pattern mirrors the kiosk stream: short-lived function (~55s), retry: 1000
// so EventSource reconnects seamlessly, heartbeat comments to keep proxies
// alive, push only on change (rev hash).
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

  const { sessionSnapshot } = await import('@/lib/appointment-session-server');

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => controller.enqueue(encoder.encode(text));
      send('retry: 1000\n\n');

      let lastRev = '';
      let lastBeat = Date.now();
      const startedAt = Date.now();
      let closed = false;
      const abort = () => { closed = true; };
      req.signal.addEventListener('abort', abort);

      try {
        while (!closed && Date.now() - startedAt < LIFETIME_MS) {
          const snap = await sessionSnapshot(bookingId).catch(() => null);
          if (!snap) { send('event: gone\ndata: {}\n\n'); break; }
          if (snap.rev !== lastRev) {
            lastRev = snap.rev;
            send(`data: ${JSON.stringify(snap)}\n\n`);
            lastBeat = Date.now();
          } else if (Date.now() - lastBeat > HEARTBEAT_MS) {
            send(': hb\n\n');
            lastBeat = Date.now();
          }
          await new Promise((r) => setTimeout(r, POLL_MS));
        }
      } catch { /* connection torn down mid-write — EventSource will reconnect */ }
      req.signal.removeEventListener('abort', abort);
      try { controller.close(); } catch { /* already closed */ }
    },
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
