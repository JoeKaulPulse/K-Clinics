import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// GDPR retention: delete kiosk sessions (and their cascaded results/events) and
// the associated Blob photos older than 30 days. Protected by CRON_SECRET.
const RETENTION_DAYS = 30;

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorised' }, { status: 401 });
  }

  const { db } = await import('@/lib/db');
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const stale = await db.kioskSession.findMany({
    where: { createdAt: { lt: cutoff } },
    select: { id: true, photoUrl: true },
  });
  if (stale.length === 0) return NextResponse.json({ ok: true, deleted: 0 });

  // Delete the Blob photos first (best-effort).
  const urls = stale.map((s) => s.photoUrl).filter((u): u is string => !!u);
  if (urls.length && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { del } = await import('@vercel/blob');
      await del(urls);
    } catch (e) {
      console.error('[kiosk-cleanup] blob delete failed:', (e as Error)?.message);
    }
  }

  // Cascade deletes results + (sessionId-linked) — events keyed by sessionId are
  // nullable so we clear those explicitly too.
  const ids = stale.map((s) => s.id);
  await db.kioskEvent.deleteMany({ where: { sessionId: { in: ids } } }).catch(() => {});
  const { count } = await db.kioskSession.deleteMany({ where: { id: { in: ids } } });

  return NextResponse.json({ ok: true, deleted: count });
}
