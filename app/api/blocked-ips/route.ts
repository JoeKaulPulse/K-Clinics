import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Internal feed of the active IP deny-list, consumed by the edge middleware
// (mirrors /api/redirects). BLD-807: the guard is a real shared secret
// (MW_BLOCK_SECRET, defaulting to the already-configured CRON_SECRET) compared
// timing-safe — the old hardcoded 'x-mw-block: 1' was guessable, letting any
// external caller read the list and learn whether their IP is blocked. An
// unauthorised caller still gets an empty 200 (not a 401), so the response is
// indistinguishable from "no blocks". Fails open (empty list) on error.
export async function GET(req: Request) {
  const secret = process.env.MW_BLOCK_SECRET || process.env.CRON_SECRET || '';
  const provided = req.headers.get('x-mw-block') || '';
  const authorised = !!secret && provided.length === secret.length &&
    (() => { try { return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(secret)); } catch { return false; } })();
  if (!authorised) return NextResponse.json([], { status: 200 });
  const rows = await db.blockedIp.findMany({ where: { active: true }, select: { ip: true } }).catch(() => [] as { ip: string }[]);
  return NextResponse.json(rows.map((r) => r.ip), { headers: { 'Cache-Control': 'no-store' } });
}
