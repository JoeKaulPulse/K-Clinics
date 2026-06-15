import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// GDPR retention, two passes (protected by CRON_SECRET):
//  1. Delete kiosk sessions older than 30 days (cascades results/events) plus
//     ALL their Blob photos (v1 photoUrl + v2 photoUrls[]).
//  2. Privacy sweep for merely-EXPIRED sessions (30-min TTL, row kept for
//     analytics until pass 1): delete their v2 photoUrls[] blobs and null the
//     live mirror frame — selfie media never outlives the session.
const RETENTION_DAYS = 30;
const MEDIA_SWEEP_BATCH = 500;

export async function GET(req: Request) {
  const { cronAuthorized } = await import('@/lib/cron-auth');
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorised' }, { status: 401 });
  }

  const { db } = await import('@/lib/db');
  const { deleteKioskBlobs } = await import('@/lib/kiosk');
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  // ── Pass 1: 30-day hard delete ─────────────────────────────────────────────
  const stale = await db.kioskSession.findMany({
    where: { createdAt: { lt: cutoff } },
    select: { id: true, photoUrl: true, photoUrls: true },
  });

  let deleted = 0;
  if (stale.length) {
    await deleteKioskBlobs(stale.flatMap((s) => [s.photoUrl, ...s.photoUrls]));
    const ids = stale.map((s) => s.id);
    // Cascade deletes results; events keyed by sessionId are nullable so clear
    // those explicitly too.
    await db.kioskEvent.deleteMany({ where: { sessionId: { in: ids } } }).catch(() => {});
    ({ count: deleted } = await db.kioskSession.deleteMany({ where: { id: { in: ids } } }));
  }

  // ── Pass 2: expired-session media sweep (kiosk v2 privacy hook) ────────────
  const expired = await db.kioskSession.findMany({
    where: {
      expiresAt: { lt: new Date() },
      OR: [{ liveFrame: { not: null } }, { photoUrls: { isEmpty: false } }],
    },
    select: { id: true, photoUrl: true, photoUrls: true },
    take: MEDIA_SWEEP_BATCH,
  });

  let mediaPurged = 0;
  if (expired.length) {
    await deleteKioskBlobs(expired.flatMap((s) => s.photoUrls));
    const ids = expired.map((s) => s.id);
    await db.kioskSession.updateMany({
      where: { id: { in: ids } },
      data: { photoUrls: [], liveFrame: null, liveFrameAt: null },
    });
    // photoUrl is only nulled when it pointed at a blob we just deleted (v2
    // sessions mirror photoUrls[0] there); v1 photoUrl blobs keep the original
    // 30-day retention and fall to pass 1.
    const v2Ids = expired.filter((s) => s.photoUrl && s.photoUrls.includes(s.photoUrl)).map((s) => s.id);
    if (v2Ids.length) {
      await db.kioskSession.updateMany({ where: { id: { in: v2Ids } }, data: { photoUrl: null } }).catch(() => {});
    }
    // Results of those sessions: bestPhotoUrl (and its photoUrl mirror) now
    // dangle — clear them. Only touches v2 results (bestPhotoUrl set).
    await db.kioskResult.updateMany({
      where: { sessionId: { in: ids }, bestPhotoUrl: { not: null } },
      data: { bestPhotoUrl: null, photoUrl: null },
    }).catch(() => {});
    mediaPurged = expired.length;
  }

  return NextResponse.json({ ok: true, deleted, mediaPurged });
}
