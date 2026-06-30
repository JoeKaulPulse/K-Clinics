import { NextResponse } from 'next/server';
import { clientIp, hashIp, logKioskEvent } from '@/lib/kiosk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED = new Set(['scan', 'consent', 'photo', 'analyzed', 'shared', 'claimed']);

// Public funnel-event sink the client can POST to (e.g. `scan`, `claimed`).
export async function POST(req: Request) {
  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!await enforceRateLimit(req, 'kiosk-events', 60, 600)) {
    return NextResponse.json({ ok: false, error: 'Too many requests.' }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const event = typeof body?.event === 'string' ? body.event : null;
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : null;
  if (!event || !ALLOWED.has(event)) return NextResponse.json({ ok: false, error: 'bad_event' }, { status: 400 });

  await logKioskEvent(event, sessionId, hashIp(clientIp(req)));
  return NextResponse.json({ ok: true });
}
