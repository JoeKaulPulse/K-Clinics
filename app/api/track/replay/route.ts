import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_EVENTS = 20_000; // cap stored events per session
const MAX_BATCH = 200;

// Store a batch of rrweb replay events as a chunk. Public + consent-gated client
// side; stores no personal data (inputs are masked at capture).
export async function POST(req: Request) {
  if (!crmEnabled) return Response.json({ ok: false }, { status: 503 });
  try {
    const body = await req.json();
    const sessionKey = String(body.sessionKey || '').slice(0, 64);
    const events = Array.isArray(body.events) ? body.events.slice(0, MAX_BATCH) : [];
    if (!sessionKey || events.length === 0) return Response.json({ ok: false }, { status: 400 });

    const { db } = await import('@/lib/db');
    const path = String(body.path || '/').slice(0, 200);
    const device = body.device ? String(body.device).slice(0, 16) : null;

    const session = await db.replaySession.upsert({
      where: { sessionKey },
      create: { sessionKey, path, device, eventCount: events.length, lastAt: new Date() },
      update: { eventCount: { increment: events.length }, lastAt: new Date() },
    });
    if (session.eventCount > MAX_EVENTS) return Response.json({ ok: true }); // cap reached, drop silently

    const seq = await db.replayChunk.count({ where: { sessionId: session.id } });
    const first = events[0] as { timestamp?: number } | undefined;
    const last = events[events.length - 1] as { timestamp?: number } | undefined;
    const durationMs = first?.timestamp && last?.timestamp ? Math.max(0, last.timestamp - first.timestamp) : 0;
    await db.replayChunk.create({ data: { sessionId: session.id, seq, events } });
    if (durationMs) await db.replaySession.update({ where: { id: session.id }, data: { durationMs: { increment: durationMs } } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
}
