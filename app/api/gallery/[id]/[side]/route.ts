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

  const data = side === 'before' ? item.beforeImage : item.afterImage;
  const type = side === 'before' ? item.beforeType : item.afterType;
  if (!data) return new Response('Not found', { status: 404 });

  return new Response(Buffer.from(data), {
    headers: {
      'Content-Type': type || 'image/jpeg',
      // Content is immutable per (id, updatedAt); pages bust the cache with ?v=.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
