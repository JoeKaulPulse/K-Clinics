import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const revalidate = 300; // re-fetch at most every 5 minutes

// Public leaderboard: top loyalty-points earners who have opted in.
// Only returns firstName (or leaderboardDisplayName), photo URL (optional),
// tier, and total points — no PII beyond what the client consented to share.
export async function GET() {
  if (!crmEnabled) return NextResponse.json({ ok: true, entries: [] });

  try {
    const { db } = await import('@/lib/db');
    const clients = await db.client.findMany({
      where: { leaderboardOptIn: true },
      select: {
        id: true,
        firstName: true,
        leaderboardDisplayName: true,
        leaderboardPhotoUrl: true,
        membershipTier: true,
        points: { select: { points: true } },
      },
      take: 50,
    });

    const entries = clients
      .map((c) => ({
        id: c.id,
        name: c.leaderboardDisplayName || c.firstName || 'Member',
        photoUrl: c.leaderboardPhotoUrl ?? null,
        tier: c.membershipTier ?? null,
        totalPoints: c.points.reduce((s, r) => s + r.points, 0),
      }))
      .filter((e) => e.totalPoints > 0)
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, 20);

    return NextResponse.json({ ok: true, entries });
  } catch (e) {
    console.error('[leaderboard]', (e as Error)?.message);
    return NextResponse.json({ ok: true, entries: [] });
  }
}
