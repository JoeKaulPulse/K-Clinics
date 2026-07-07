import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Serve a gallery before/after image from the DB. (BLD-765)
//
// These are real patient before/after photos. A case only becomes public once
// an admin ticks BOTH "Show on website" (published) and confirms written client
// consent (consent) — the public gallery query enforces that (lib/gallery-data.ts).
// This serving route must enforce the same gate: an unguessable cuid is not an
// access control, and the id leaks (referer, browser history, shared preview
// links, logs), so without this check a non-consented or not-yet-published
// patient photo is served to anyone who has the URL.
//
// The one legitimate viewer of a non-public image is an admin curating the
// gallery (the admin manager previews unpublished items via this same route),
// so an authenticated user with settings.manage — the permission that guards
// /admin/gallery — may still fetch it, but that response is never cached by a
// shared cache.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; side: string }> }) {
  if (!crmEnabled) return new Response('Not found', { status: 404 });
  const { id, side } = await params;
  if (side !== 'before' && side !== 'after') return new Response('Bad request', { status: 400 });

  const { db } = await import('@/lib/db');
  const item = await db.galleryItem.findUnique({ where: { id } }).catch(() => null);
  if (!item) return new Response('Not found', { status: 404 });

  const isPublic = item.published && item.consent;
  if (!isPublic) {
    // Non-public case: only an authenticated gallery curator may preview it.
    // Anyone else gets a plain 404 — same as a missing item, so the response
    // never confirms that a withheld/non-consented photo exists.
    const { getSession, sessionCan } = await import('@/lib/auth');
    const session = await getSession();
    if (!sessionCan(session, 'settings.manage')) return new Response('Not found', { status: 404 });
  }

  const data = side === 'before' ? item.beforeImage : item.afterImage;
  const type = side === 'before' ? item.beforeType : item.afterType;
  if (!data) return new Response('Not found', { status: 404 });

  return new Response(Buffer.from(data), {
    headers: {
      'Content-Type': type || 'image/jpeg',
      // Public cases are immutable per (id, updatedAt); pages bust the cache with
      // ?v=. A non-public admin preview must never be stored by a shared/CDN cache.
      'Cache-Control': isPublic ? 'public, max-age=31536000, immutable' : 'private, no-store',
    },
  });
}
