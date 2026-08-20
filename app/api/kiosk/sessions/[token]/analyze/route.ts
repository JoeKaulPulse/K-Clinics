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

  // BLD-808: claim the session atomically before scheduling the AI job — a
  // fast double-tap or client retry used to pass the status check twice and
  // trigger (and bill) two full analyses. Only the caller that flips stage to
  // 'analyzing' schedules; the loser gets the same success shape and follows
  // progress over SSE. A failed run resets stage to 'failed' (lib/kiosk.ts),
  // so retries after a genuine failure still pass this claim.
  // BLD-1418: if the background after() call itself is platform-killed before
  // it can reset stage (rather than throwing, which lib/kiosk.ts already
  // catches), the row wedges in 'analyzing' forever and this claim never
  // re-passes. maxDuration is 60s, so a session still claimed well past that
  // is dead, not slow — allow re-claiming it rather than trusting stage alone.
  // A NULL analyzingSince never satisfies `lt` (SQL three-valued logic), so it
  // needs its own branch or the rows that matter most stay wedged: sessions
  // already claimed when this shipped (the column backfills as NULL), and any
  // set to 'analyzing' through the public stage route, which stamps nothing.
  // `updatedAt` is the fallback clock — it bumps on every write to the row, so
  // it is never older than the claim that wedged it.
  const STUCK_MS = 90_000;
  const staleAt = new Date(Date.now() - STUCK_MS);
  const claimed = await db.kioskSession.updateMany({
    where: {
      id: session.id,
      OR: [
        { stage: { not: 'analyzing' } },
        { stage: 'analyzing', analyzingSince: { lt: staleAt } },
        { stage: 'analyzing', analyzingSince: null, updatedAt: { lt: staleAt } },
      ],
    },
    data: { stage: 'analyzing', analyzingSince: new Date() },
  });
  if (claimed.count === 0) return NextResponse.json({ ok: true, already: true });

  after(async () => { await runKioskAnalysisV2(session.id).catch(() => {}); });

  return NextResponse.json({ ok: true });
}
