import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Return a session's full rrweb event stream (chunks concatenated) for playback.
// Requires campaigns.view.
export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = (await requirePermission('campaigns.view')) || (await requirePermission('settings.manage'));
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });
  const { db } = await import('@/lib/db');
  const chunks = await db.replayChunk.findMany({ where: { sessionId: id }, orderBy: { seq: 'asc' }, select: { events: true } });
  const events = chunks.flatMap((c) => (Array.isArray(c.events) ? (c.events as unknown[]) : []));
  return NextResponse.json({ ok: true, events });
}
