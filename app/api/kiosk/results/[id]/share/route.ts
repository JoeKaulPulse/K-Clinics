import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clientIp, hashIp, logKioskEvent } from '@/lib/kiosk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Max shares logged from a single IP in a rolling hour window (allows all
// platforms but caps bot inflation).
const MAX_SHARES_PER_HOUR = 20;

// Public. Increments the share counter for a result and flips its session to
// SHARED, logging a `shared` funnel event. Rate-limited per IP to prevent
// share-count inflation (important now that sharing gates a discount reward).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await db.kioskResult.findUnique({
    where: { id },
    select: { id: true, sessionId: true },
  });
  if (!result) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

  // Rate-limit by IP.
  const ipHash = hashIp(clientIp(req));
  if (ipHash) {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentShares = await db.kioskEvent.count({
      where: { event: 'shared', ipHash, createdAt: { gte: hourAgo } },
    });
    if (recentShares >= MAX_SHARES_PER_HOUR) {
      return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
    }
  }

  await db.kioskResult.update({ where: { id }, data: { shareCount: { increment: 1 } } });
  await db.kioskSession.update({ where: { id: result.sessionId }, data: { status: 'SHARED' } }).catch(() => {});
  await logKioskEvent('shared', result.sessionId, ipHash);

  return NextResponse.json({ ok: true });
}
