import { crmEnabled } from '@/lib/crm';
import { sseSnapshotStream, SSE_HEADERS } from '@/lib/sse-snapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// BLD-138 v2 — client SSE channel for the phone companion page. Token-authed
// (booking manageToken); streams only the sanitised client view.
// BLD-145: loop/heartbeat/lifetime/abort/cancel/error policy extracted to
// lib/sse-snapshot; only auth + load/probe logic lives here.

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!crmEnabled) return new Response('disabled', { status: 503 });
  // BLD-1802: per-IP cap on NEW stream connections. sseSnapshotStream ends each
  // one at lifetimeMs (55s) and EventSource immediately reconnects, so a single
  // phone legitimately opens ~11 connections per 10 minutes — two devices on one
  // NAT already exceeded the original 20/600s and were dropped onto the poll
  // fallback, which then hit its own limit. A 60s window keyed on IP still caps
  // a connection flood without punishing normal reconnects.
  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'booking-live-stream', 20, 60))) {
    return new Response('too many attempts', { status: 429 });
  }
  const { token } = await params;
  const { db } = await import('@/lib/db');
  const b = await db.booking.findUnique({ where: { manageToken: token }, select: { id: true } });
  if (!b) return new Response('not found', { status: 404 });

  const { sessionSnapshot, sessionProbe, clientView } = await import('@/lib/appointment-session-server');
  const bookingId = b.id;

  return new Response(
    sseSnapshotStream({
      probe: () => sessionProbe(bookingId),
      load: async () => {
        const snap = await sessionSnapshot(bookingId);
        return snap ? clientView(snap) : null;
      },
      pollMs: 1000,
      retryMs: 1200,
      signal: req.signal,
    }),
    { headers: SSE_HEADERS },
  );
}
