import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Internal feed of the active IP deny-list, consumed by the edge middleware
// (mirrors /api/redirects). Guarded by the internal header the middleware sends
// so the list isn't casually readable from outside — an attacker shouldn't be
// able to learn whether their IP is blocked. Fails open (empty list) on error.
export async function GET(req: Request) {
  if (req.headers.get('x-mw-block') !== '1') return NextResponse.json([], { status: 200 });
  const rows = await db.blockedIp.findMany({ where: { active: true }, select: { ip: true } }).catch(() => [] as { ip: string }[]);
  return NextResponse.json(rows.map((r) => r.ip), { headers: { 'Cache-Control': 'no-store' } });
}
