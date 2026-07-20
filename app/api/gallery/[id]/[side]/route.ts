import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Serve a gallery before/after image from the DB. IDs are unguessable cuids;
// images are only ever referenced from published items on the public gallery.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; side: string }> }) {
  if (!crmEnabled) return new Response('Not found', { status: 404 });
  const { id, side } = await params;
  if (side !== 'before' && side !== 'after') return new Response('Bad request', { status: 400 });

  const { db } = await import('@/lib/db');
  const item = await db.galleryItem.findUnique({ where: { id } }).catch(() => null);
  if (!item) return new Response('Not found', { status: 404 });

  // BLD-854: published + consent exist precisely so a draft or unconsented
  // before/after can't go live, but this route streamed bytes for any id.
  // Public access now requires both; drafts stay viewable to signed-in staff
  // only (the admin gallery manager previews through this same URL).
  const publiclyVisible = item.published && item.consent;
  let staff = false;
  if (!publiclyVisible) {
    const { getSession } = await import('@/lib/auth');
    staff = !!(await getSession());
    if (!staff) return new Response('Not found', { status: 404 });
  }

  const data = side === 'before' ? item.beforeImage : item.afterImage;
  const type = side === 'before' ? item.beforeType : item.afterType;
  if (!data) return new Response('Not found', { status: 404 });

  return new Response(Buffer.from(data), {
    headers: {
      'Content-Type': type || 'image/jpeg',
      // Public content is immutable per (id, updatedAt); pages bust the cache
      // with ?v=. Staff-only drafts must never land in a shared cache.
      'Cache-Control': publiclyVisible ? 'public, max-age=31536000, immutable' : 'private, no-store',
    },
  });
}
