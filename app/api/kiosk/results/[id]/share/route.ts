import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logKioskEvent } from '@/lib/kiosk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public. Increments the share counter for a result and flips its session to
// SHARED, logging a `shared` funnel event.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await db.kioskResult.findUnique({ where: { id }, select: { id: true, sessionId: true } });
  if (!result) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

  await db.kioskResult.update({ where: { id }, data: { shareCount: { increment: 1 } } });
  await db.kioskSession.update({ where: { id: result.sessionId }, data: { status: 'SHARED' } }).catch(() => {});
  await logKioskEvent('shared', result.sessionId);

  return NextResponse.json({ ok: true });
}
