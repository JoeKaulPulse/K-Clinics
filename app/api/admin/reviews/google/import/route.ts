import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Token-authed bulk import of Google reviews — Authorization: Bearer
// BOARD_QUEUE_TOKEN. Used to load the existing Google review history before the
// Business Profile API is approved; each row publishes on the public reviews
// surface immediately. Idempotent: a stable googleName per (name|date|text) so
// re-running never duplicates.
function tokenOk(req: Request): boolean {
  const expected = process.env.BOARD_QUEUE_TOKEN;
  if (!expected) return false;
  const got = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!got || got.length !== expected.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected)); } catch { return false; }
}

type In = { reviewerName?: string; starRating?: number | string; comment?: string; createTime?: string };

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  if (!tokenOk(req)) return NextResponse.json({ ok: false, error: 'Unauthorised' }, { status: 401 });

  // Bound abuse — this publishes to the public "verified" reviews surface.
  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'greview-import', 10, 600, 'admin'))) {
    return NextResponse.json({ ok: false, error: 'Rate limit exceeded.' }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as { reviews?: In[] };
  const list = Array.isArray(body.reviews) ? body.reviews : [];
  if (!list.length) return NextResponse.json({ ok: false, error: 'No reviews supplied.' }, { status: 400 });

  const { db } = await import('@/lib/db');
  let added = 0;
  for (const it of list.slice(0, 300)) {
    const stars = Math.max(1, Math.min(5, Math.round(Number(it?.starRating) || 0)));
    if (!stars) continue;
    const name = (typeof it?.reviewerName === 'string' ? it.reviewerName.trim().slice(0, 120) : '') || null;
    const comment = (typeof it?.comment === 'string' ? it.comment.trim().slice(0, 4000) : '') || null;
    const parsed = it?.createTime ? new Date(String(it.createTime)) : new Date();
    const createTime = isNaN(parsed.getTime()) ? new Date() : parsed;
    const slug = (name || 'anon').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    const hash = crypto.createHash('sha1').update(`${name}|${createTime.toISOString().slice(0, 10)}|${comment}`).digest('hex').slice(0, 8);
    const googleName = `import:${slug}:${hash}`;
    const row = { reviewerName: name, starRating: stars, comment, createTime };
    await db.googleReview.upsert({ where: { googleName }, update: row, create: { googleName, ...row } })
      .then(() => { added++; }).catch(() => {});
  }
  // Refresh the public reviews surfaces immediately (don't wait for ISR).
  try { revalidatePath('/reviews'); revalidatePath('/'); } catch { /* ignore */ }
  return NextResponse.json({ ok: true, added });
}
