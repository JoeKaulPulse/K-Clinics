import { crmEnabled } from '@/lib/crm';
import { sseSnapshotStream, SSE_HEADERS } from '@/lib/sse-snapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// BLD-138 v2 — staff SSE channel for the live appointment session. Every open
// device (front desk, host iPad, clinician, checkout) receives the same
// snapshot stream and reconciles instantly — no refreshes between handoffs.
// BLD-145: loop/heartbeat/lifetime/abort/cancel/error policy extracted to
// lib/sse-snapshot; only auth + load/probe logic lives here.

export async function GET(req: Request) {
  if (!crmEnabled) return new Response('disabled', { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('bookings.manage');
  if (!session) return new Response('forbidden', { status: 403 });

  const bookingId = new URL(req.url).searchParams.get('bookingId') || '';
  if (!bookingId) return new Response('missing bookingId', { status: 400 });

  const { sessionSnapshot, sessionProbe } = await import('@/lib/appointment-session-server');

  return new Response(
    sseSnapshotStream({
      probe: () => sessionProbe(bookingId),
      load: () => sessionSnapshot(bookingId),
      pollMs: 750,
      retryMs: 1000,
      signal: req.signal,
    }),
    { headers: SSE_HEADERS },
  );
}
