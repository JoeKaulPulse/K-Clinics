import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Live team-chat signal. Streams a tiny per-user snapshot of channel ids +
// lastMessageAt + unread (see lib/team-chat streamSnapshot). The client treats a
// change as "fetch deltas" — keeps the hot path cheap and the payload private
// (no message bodies cross the wire here). Closes ~55s; the browser reconnects.
export async function GET(req: Request) {
  if (!crmEnabled) return new Response('disabled', { status: 503 });
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();
  if (!session) return new Response('forbidden', { status: 403 });

  const { sseSnapshotStream, SSE_HEADERS } = await import('@/lib/sse-snapshot');
  const { streamSnapshot } = await import('@/lib/team-chat');

  return new Response(
    sseSnapshotStream({
      load: () => streamSnapshot(session.sub),
      pollMs: 1500,
      signal: req.signal,
    }),
    { headers: SSE_HEADERS },
  );
}
