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
