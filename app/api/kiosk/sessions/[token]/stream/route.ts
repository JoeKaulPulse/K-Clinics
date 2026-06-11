import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { secretMatches } from '@/lib/kiosk';
import { buildKioskStreamPayload, KIOSK_STREAM_SELECT } from '@/lib/kiosk-live';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const POLL_MS = 500;        // in-function DB poll cadence
const HEARTBEAT_MS = 15_000; // SSE comment to keep proxies from closing us
const LIFETIME_MS = 55_000;  // end cleanly before the 60s function cap

// BLD-159: best-effort per-token concurrent-connection cap (defence-in-depth on
// top of the required secret). Module-scoped — bounds connections per warm
// lambda instance, which is where a runaway client would pile them up.
const MAX_CONNS_PER_TOKEN = 3;
const liveConns = new Map<string, number>();

// Public, token-scoped SSE for the storefront display (and the phone, if it
// wants push instead of polling). Polls the session every 500ms inside the
// function and emits a `data:` event ONLY when the payload changed (JSON
// compare), with a heartbeat comment every 15s. The stream ends cleanly at
// ~55s; `retry: 1000` makes EventSource reconnect fast, so the display sees a
// continuous feed. The existing GET /sessions/[token] poll stays as fallback.
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const provided = new URL(req.url).searchParams.get('s');

  const exists = await db.kioskSession.findUnique({ where: { token }, select: { id: true, secret: true } });
  if (!exists) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  // BLD-159: the live camera feed is gated by the per-session secret (carried in
  // the QR). A caller who only guessed the short token cannot read frames.
  if (!secretMatches(exists.secret, provided)) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

  // Cap concurrent streams per token (anti-DB-exhaustion).
  if ((liveConns.get(token) ?? 0) >= MAX_CONNS_PER_TOKEN) {
    return NextResponse.json({ ok: false, error: 'too_many_connections' }, { status: 429 });
  }
  liveConns.set(token, (liveConns.get(token) ?? 0) + 1);
  let released = false;
  const releaseConn = () => {
    if (released) return;
    released = true;
    const n = (liveConns.get(token) ?? 1) - 1;
    if (n <= 0) liveConns.delete(token); else liveConns.set(token, n);
  };

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const close = () => {
        if (closed) return;
        closed = true;
        releaseConn();
        try { controller.close(); } catch { /* already closed */ }
      };
      const send = (chunk: string) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(chunk)); } catch { closed = true; }
      };

      req.signal?.addEventListener('abort', close);

      // Fast reconnect after our deliberate ~55s close.
      send('retry: 1000\n\n');

      const started = Date.now();
      let lastJson = '';
      let lastActivity = Date.now();

      while (!closed && Date.now() - started < LIFETIME_MS) {
        try {
          const session = await db.kioskSession.findUnique({
            where: { token },
            select: KIOSK_STREAM_SELECT,
          });
          if (!session) break; // deleted (e.g. test cleanup) — end the stream

          const payload = buildKioskStreamPayload(session);
          const json = JSON.stringify(payload);
          if (json !== lastJson) {
            send(`data: ${json}\n\n`);
            lastJson = json;
            lastActivity = Date.now();
          } else if (Date.now() - lastActivity >= HEARTBEAT_MS) {
            send(': hb\n\n');
            lastActivity = Date.now();
          }
        } catch {
          // Transient DB error — keep the stream alive; next poll retries.
        }
        if (closed) break;
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
      close();
    },
    cancel() {
      closed = true; // reader went away — stop the poll loop
      releaseConn();
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
