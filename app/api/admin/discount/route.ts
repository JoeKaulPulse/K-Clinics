import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Staff override of a welcome-discount claim: revoke an active one, or restore
// (grant) a blocked one after manual review.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });

  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('discounts.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

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
    // Restore/grant: make this the active claim and mark reviewed. Guard against
    // handing a client two welcome offers — refuse if they already hold another
    // active/redeemed claim.
    const other = await db.discountClaim.findFirst({
      where: { clientId: claim.clientId, id: { not: claimId }, status: { in: ['ACTIVE', 'REDEEMED'] } },
      select: { id: true, status: true },
    });
    if (other) return NextResponse.json({ ok: false, error: `This client already has ${other.status === 'REDEEMED' ? 'used' : 'an active'} welcome discount — revoke it first.` }, { status: 409 });
    // If this was an anti-abuse placeholder, mint a clean welcome code so the
    // client never sees a "BLOCKED-…" code on their dashboard once it's granted.
    const regen = claim.code.startsWith('BLOCKED-') ? { code: `KC15-${crypto.randomBytes(3).toString('hex').toUpperCase()}` } : {};
    await db.discountClaim.update({
      where: { id: claimId },
      data: { status: 'ACTIVE', reviewedBy: session.email, flagged: false, ...regen },
    });
    await db.client.update({ where: { id: claim.clientId }, data: { firstDiscountClaimed: true } });
  }
  return NextResponse.json({ ok: true });
}
