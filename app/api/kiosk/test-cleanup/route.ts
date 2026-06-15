import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Token-authed cleanup for the Visual QA harness: deletes the exact kiosk sessions
// a test run created (by token) — cascading their results/events and removing the
// uploaded photos from Blob — so visual QA against production leaves no residue.
// Auth: Bearer BOARD_QUEUE_TOKEN (the QA routine already holds it).
function tokenOk(req: Request): boolean {
  const secret = process.env.BOARD_QUEUE_TOKEN;
  if (!secret) return false;
  const provided = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!provided || provided.length !== secret.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(secret)); } catch { return false; }
}

export async function POST(req: Request) {
  if (!process.env.BOARD_QUEUE_TOKEN) return NextResponse.json({ ok: false, error: 'Not configured.' }, { status: 503 });
  if (!tokenOk(req)) return NextResponse.json({ ok: false, error: 'Unauthorised' }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const tokens = Array.isArray(b?.tokens) ? b.tokens.map(String).slice(0, 50) : [];
  if (!tokens.length) return NextResponse.json({ ok: false, error: 'No tokens.' }, { status: 400 });

  const sessions = await db.kioskSession.findMany({ where: { token: { in: tokens } }, select: { id: true, photoUrl: true, photoUrls: true } });
  if (!sessions.length) return NextResponse.json({ ok: true, deleted: 0 });

  // v1 photoUrl + v2 multi-capture photoUrls[] — remove every uploaded blob.
  const urls = Array.from(new Set(sessions.flatMap((s) => [s.photoUrl, ...s.photoUrls]).filter((u): u is string => !!u)));
  if (urls.length && process.env.BLOB_READ_WRITE_TOKEN) {
    try { const { del } = await import('@vercel/blob'); await del(urls); } catch (e) { console.error('[kiosk test-cleanup] blob del failed', (e as Error)?.message); }
  }
  const ids = sessions.map((s) => s.id);
  await db.kioskEvent.deleteMany({ where: { sessionId: { in: ids } } }).catch(() => {});
  const { count } = await db.kioskSession.deleteMany({ where: { id: { in: ids } } });
  return NextResponse.json({ ok: true, deleted: count });
}
