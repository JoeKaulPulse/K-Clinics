import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Admin actions on imported Google reviews: sync, reply, delete reply, disconnect.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('reviews.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const gb = await import('@/lib/google-business');

  switch (b.op) {
    case 'locations': {
      const r = await gb.listBusinessLocations();
      return NextResponse.json({ ok: true, ...r });
    }
    case 'setLocation': {
      if (!b.ref || typeof b.ref !== 'string') return NextResponse.json({ ok: false, error: 'Bad request.' }, { status: 400 });
      const r = await gb.setBusinessLocation(String(b.ref));
      if (r.ok) {
        // Import straight away so the owner sees reviews immediately.
        const synced = await gb.syncGoogleReviews();
        return NextResponse.json({ ...r, imported: synced.imported });
      }
      return NextResponse.json(r, { status: 400 });
    }
    case 'sync': {
      const r = await gb.syncGoogleReviews();
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    case 'reply': {
      if (!b.googleName || typeof b.comment !== 'string') return NextResponse.json({ ok: false, error: 'Bad request.' }, { status: 400 });
      const r = await gb.replyToGoogleReview(String(b.googleName), String(b.comment));
      if (r.ok) {
        const { logAudit } = await import('@/lib/audit');
        await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: 'Replied to a Google review' });
      }
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    case 'deleteReply': {
      if (!b.googleName) return NextResponse.json({ ok: false, error: 'Bad request.' }, { status: 400 });
      const r = await gb.deleteGoogleReply(String(b.googleName));
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    case 'disconnect': {
      await gb.disconnectGoogleBusiness();
      return NextResponse.json({ ok: true });
    }
  }
  return NextResponse.json({ ok: false, error: 'Unknown op.' }, { status: 400 });
}
