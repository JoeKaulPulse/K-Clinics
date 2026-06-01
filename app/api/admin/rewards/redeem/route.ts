import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Staff redeem a reward (self); managers fulfil/decline pending redemptions.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!session || !sessionCan(session, 'rewards.view')) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const { action, rewardId, redemptionId, decision, note } = await req.json().catch(() => ({}));
  const { redeemReward, decideRedemption } = await import('@/lib/gamification');

  if (action === 'decide') {
    if (!sessionCan(session, 'rewards.manage')) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
    if (!redemptionId || !['FULFILLED', 'DECLINED'].includes(decision)) return NextResponse.json({ ok: false, error: 'Bad request.' }, { status: 400 });
    const res = await decideRedemption(redemptionId, decision, session.email, note);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  }

  // Default: redeem for self.
  if (!rewardId) return NextResponse.json({ ok: false, error: 'Missing reward.' }, { status: 400 });
  const res = await redeemReward(session.sub, rewardId);
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
