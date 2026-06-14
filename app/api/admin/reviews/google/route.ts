import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';

const refreshPublic = () => { try { revalidatePath('/reviews'); revalidatePath('/'); } catch { /* ignore */ } };

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
        refreshPublic();
        return NextResponse.json({ ...r, imported: synced.imported });
      }
      return NextResponse.json(r, { status: 400 });
    }
    case 'sync': {
      const r = await gb.syncGoogleReviews();
      if (r.ok) refreshPublic();
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
    case 'add': {
      // Manually add a Google review (e.g. to load your existing reviews before
      // Google grants Business Profile API access). It displays on the site like
      // any imported review. Uniqueness via a synthetic googleName.
      const stars = Math.max(1, Math.min(5, Math.round(Number(b.starRating) || 0)));
      if (!stars) return NextResponse.json({ ok: false, error: 'A star rating (1–5) is required.' }, { status: 400 });
      const name = typeof b.reviewerName === 'string' ? b.reviewerName.trim() : '';
      const comment = typeof b.comment === 'string' ? b.comment.trim() : '';
      const parsed = b.createTime ? new Date(String(b.createTime)) : new Date();
      const { db } = await import('@/lib/db');
      await db.googleReview.create({ data: {
        googleName: `manual:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        reviewerName: name || null,
        starRating: stars,
        comment: comment || null,
        createTime: isNaN(parsed.getTime()) ? new Date() : parsed,
      } });
      const { logAudit } = await import('@/lib/audit');
      await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: 'Added a Google review manually' }).catch(() => {});
      refreshPublic();
      return NextResponse.json({ ok: true });
    }
    case 'delete': {
      if (!b.id && !b.googleName) return NextResponse.json({ ok: false, error: 'Bad request.' }, { status: 400 });
      const { db } = await import('@/lib/db');
      await db.googleReview.deleteMany({ where: b.id ? { id: String(b.id) } : { googleName: String(b.googleName) } });
      refreshPublic();
      return NextResponse.json({ ok: true });
    }
    case 'bulkAdd': {
      // Load many reviews at once (e.g. your existing Google reviews, before the
      // Business Profile API is approved). Each publishes on the site immediately.
      const list = Array.isArray(b.reviews) ? b.reviews : [];
      if (!list.length) return NextResponse.json({ ok: false, error: 'No reviews to add.' }, { status: 400 });
      const { db } = await import('@/lib/db');
      let added = 0;
      for (const it of list.slice(0, 300)) {
        const stars = Math.max(1, Math.min(5, Math.round(Number(it?.starRating) || 0)));
        if (!stars) continue;
        const parsed = it?.createTime ? new Date(String(it.createTime)) : new Date();
        await db.googleReview.create({ data: {
          googleName: `manual:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`,
          reviewerName: (typeof it?.reviewerName === 'string' ? it.reviewerName.trim() : '') || null,
          starRating: stars,
          comment: (typeof it?.comment === 'string' ? it.comment.trim() : '') || null,
          createTime: isNaN(parsed.getTime()) ? new Date() : parsed,
        } }).then(() => { added++; }).catch(() => {});
      }
      const { logAudit } = await import('@/lib/audit');
      await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Bulk-added ${added} Google reviews` }).catch(() => {});
      refreshPublic();
      return NextResponse.json({ ok: true, added });
    }
  }
  return NextResponse.json({ ok: false, error: 'Unknown op.' }, { status: 400 });
}
