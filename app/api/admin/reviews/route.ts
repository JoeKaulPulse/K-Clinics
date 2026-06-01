import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Review moderation: approve, hide, publish, or re-send a request. Requires
// reviews.manage.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('reviews.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const { id, action } = await req.json().catch(() => ({}));
  if (!id || !action) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });

  const { db } = await import('@/lib/db');
  const { logAudit } = await import('@/lib/audit');

  if (action === 'approve' || action === 'hide') {
    const status = action === 'approve' ? 'APPROVED' : 'HIDDEN';
    await db.review.update({ where: { id }, data: { status, moderatedBy: session.email, moderatedAt: new Date() } });
    // Award the clinician their review points on approval (idempotent).
    if (status === 'APPROVED') {
      try {
        const { awardForReview } = await import('@/lib/gamification');
        await awardForReview(id);
        const { awardClientReview } = await import('@/lib/client-loyalty');
        await awardClientReview(id); // thank-you points for the client (idempotent)
        await logAudit({ action: 'POINTS_AWARDED', actor: session.email, actorRole: session.role, summary: 'Review points awarded to clinician' });
      } catch { /* non-fatal */ }
    }
    return NextResponse.json({ ok: true });
  }

  if (action === 'publish') {
    // Publishing makes the review visible on our marketing site. The Google
    // push is a separate (currently inert) step, so we do NOT set
    // pushedToGoogleAt here — that's stamped only when actually synced to Google.
    const r = await db.review.update({ where: { id }, data: { status: 'PUBLISHED', moderatedBy: session.email, moderatedAt: new Date() } });
    // Ensure clinician points are awarded even if published without a separate
    // approve step (idempotent — never double-awards).
    try {
      const { awardForReview } = await import('@/lib/gamification');
      await awardForReview(id);
      const { awardClientReview } = await import('@/lib/client-loyalty');
      await awardClientReview(id);
    } catch { /* non-fatal */ }
    await logAudit({ action: 'REVIEW_PUBLISHED', actor: session.email, actorRole: session.role, clientId: r.clientId, summary: 'Review published' });
    return NextResponse.json({ ok: true });
  }

  if (action === 'resend') {
    const { sendReviewRequest } = await import('@/lib/review-system');
    const res = await sendReviewRequest(id, 'EMAIL');
    return NextResponse.json(res);
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
}
