import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logKioskEvent } from '@/lib/kiosk';
import { isKioskStage } from '@/lib/kiosk-live';
import { rateLimit } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public, token-scoped. The phone drives the live stage machine here; the
// display mirrors it over SSE. Validation is loose by design (any move between
// known stages is allowed — the phone owns sequencing); unknown stages → 400.
// `ageDeclared: true` stamps the explicit 18+ tap exactly once.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const body = await req.json().catch(() => null);
  const stage = body?.stage;
  if (!isKioskStage(stage)) {
    return NextResponse.json({ ok: false, error: 'unknown_stage' }, { status: 400 });
  }

  // ~13 stages per run; generous ceiling against scripted abuse.
  const rl = await rateLimit(`kiosk-stage:${token}`, 120, 600);
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });

  const session = await db.kioskSession.findUnique({
    where: { token },
    select: { id: true, status: true, expiresAt: true, consentAt: true, ageDeclaredAt: true, ipHash: true },
  });
  if (!session) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  if (session.status === 'EXPIRED' || session.expiresAt < new Date()) {
    return NextResponse.json({ ok: false, error: 'expired' }, { status: 410 });
  }
  // Terminal states stay terminal (the AI age backstop must not be undone).
  if (session.status === 'AGE_DECLINED') {
    return NextResponse.json({ ok: false, error: 'declined' }, { status: 410 });
  }

  const data: {
    stage: string;
    poseIdx?: { increment: number };
    consentAt?: Date;
    ageDeclaredAt?: Date;
  } = { stage };
  if (stage === 'captured') data.poseIdx = { increment: 1 };
  const firstConsent = stage === 'consent' && !session.consentAt;
  if (firstConsent) data.consentAt = new Date();
  if (body?.ageDeclared === true && !session.ageDeclaredAt) data.ageDeclaredAt = new Date();

  // `updatedAt` bumps automatically (@updatedAt) on every stage write.
  await db.kioskSession.update({ where: { id: session.id }, data });

  if (firstConsent) await logKioskEvent('consent', session.id, session.ipHash);

  return NextResponse.json({ ok: true });
}
