import { NextResponse, after } from 'next/server';
import { db } from '@/lib/db';
import { runKioskAnalysisV2 } from '@/lib/kiosk';
import { rateLimit } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Public, token-scoped. Kicks off the kiosk v2 AI analysis once the visitor has
// confirmed their photo set. Hard gates (all server-enforced, the phone UI is
// not trusted): consent recorded + explicit 18+ declaration + ≥1 photo.
// The analysis itself runs via `after()` so the response returns immediately
// while the serverless function stays alive until the Sonnet call completes;
// the phone/display follow progress over SSE or the status poll.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const rl = await rateLimit(`kiosk-analyze:${token}`, 6, 600);
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });

  const session = await db.kioskSession.findUnique({
    where: { token },
    include: { result: { select: { id: true } } },
  });
  if (!session) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

  if (session.status === 'EXPIRED' || session.expiresAt < new Date()) {
    return NextResponse.json({ ok: false, error: 'expired' }, { status: 410 });
  }
  if (session.status === 'AGE_DECLINED') {
    return NextResponse.json({ ok: false, error: 'declined' }, { status: 410 });
  }
  if (!session.consentAt) {
    return NextResponse.json({ ok: false, error: 'consent_required' }, { status: 400 });
  }
  if (!session.ageDeclaredAt) {
    return NextResponse.json({ ok: false, error: 'age_declaration_required' }, { status: 400 });
  }
  if (session.photoUrls.length < 1) {
    return NextResponse.json({ ok: false, error: 'no_photos' }, { status: 400 });
  }
  // Already analysed (budget: never double-bill a session) — surface reveal.
  if (session.result && session.status === 'ANALYZED') {
    await db.kioskSession.update({ where: { id: session.id }, data: { stage: 'reveal' } }).catch(() => {});
    return NextResponse.json({ ok: true, already: true });
  }

  await db.kioskSession.update({ where: { id: session.id }, data: { stage: 'analyzing' } });

  after(async () => { await runKioskAnalysisV2(session.id).catch(() => {}); });

  return NextResponse.json({ ok: true });
}
