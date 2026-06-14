import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { secretMatches } from '@/lib/kiosk';
import { buildKioskStreamPayload, KIOSK_STREAM_SELECT } from '@/lib/kiosk-live';
import { sseSnapshotStream, SSE_HEADERS } from '@/lib/sse-snapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const POLL_MS = 500;
const HEARTBEAT_MS = 15_000;
const LIFETIME_MS = 55_000;

// BLD-159: best-effort per-token concurrent-connection cap (defence-in-depth on
// top of the required secret). Module-scoped — bounds connections per warm
// lambda instance, which is where a runaway client would pile them up.
const MAX_CONNS_PER_TOKEN = 3;
const liveConns = new Map<string, number>();

// Public, token-scoped SSE for the storefront display (and the phone, if it
// wants push instead of polling). Uses the shared sseSnapshotStream helper
// (BLD-145) for the loop/heartbeat/lifetime/abort/error policy; this route
// supplies the load logic and keeps the per-token connection cap.
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

  const inner = sseSnapshotStream({
    load: async () => {
      const session = await db.kioskSession.findUnique({ where: { token }, select: KIOSK_STREAM_SELECT });
      return session ? buildKioskStreamPayload(session) : null;
    },
    pollMs: POLL_MS,
    heartbeatMs: HEARTBEAT_MS,
    lifetimeMs: LIFETIME_MS,
    signal: req.signal ?? new AbortController().signal,
  });

  // Release the connection slot when the stream drains or is cancelled.
  const passThrough = new TransformStream<Uint8Array, Uint8Array>();
  inner.pipeTo(passThrough.writable).then(releaseConn, releaseConn);

  return new Response(passThrough.readable, { headers: SSE_HEADERS });
}
