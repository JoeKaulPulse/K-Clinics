import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Staff override of a welcome-discount claim: revoke an active one, or restore
// (grant) a blocked one after manual review.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });

  const { getSession } = await import('@/lib/auth');
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'Unauthorised' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { claimId, action } = body as { claimId?: string; action?: 'revoke' | 'restore' };
  if (!claimId || !action) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });

  const { db } = await import('@/lib/db');
  const claim = await db.discountClaim.findUnique({ where: { id: claimId } });
  if (!claim) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

  if (action === 'revoke') {
    await db.discountClaim.update({
      where: { id: claimId },
      data: { status: 'REVOKED', reviewedBy: session.email, flagged: false },
    });
  } else {
    // Restore/grant: make this the active claim and mark reviewed.
    await db.discountClaim.update({
      where: { id: claimId },
      data: { status: 'ACTIVE', reviewedBy: session.email, flagged: false },
    });
    await db.client.update({ where: { id: claim.clientId }, data: { firstDiscountClaimed: true } });
  }
  return NextResponse.json({ ok: true });
}
