import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { crmEnabled } from '@/lib/crm';
import { fetchPortfolioBlob, isBlobUrl } from '@/lib/portfolio-blob';

export const runtime = 'nodejs';

// BLD-740: portfolio photos are real before/after clinical photos, stored
// PRIVATE on Vercel Blob (they were public, unauthenticated URLs viewable by
// anyone). This relay is the only read path: the requester must be the trainee
// whose entry the photo belongs to, or signed-in staff (the tutor review
// surface). Everything else — including probes for URLs that do exist — gets
// the same 404, and the image streams with no-store headers so a subject's
// clinical photo never lands in a shared cache.
const notFound = () => NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const url = new URL(req.url).searchParams.get('u') || '';
  if (!isBlobUrl(url)) return notFound(); // never proxy arbitrary URLs

  // Trainee first (own entries only), then staff (any entry — review surface).
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  let where: { studentId?: string } | null = student ? { studentId: student.id } : null;
  if (!where) {
    const { getSession } = await import('@/lib/auth');
    const session = await getSession();
    if (session) where = {};
  }
  if (!where) return notFound();

  // The URL must appear in an entry the requester may see. Photos is a small
  // JSON array per row — scan in JS rather than trusting jsonb containment.
  const rows = await db.portfolioEntry.findMany({ where, select: { photos: true } });
  const owns = rows.some((r) => Array.isArray(r.photos) && (r.photos as { url?: unknown }[]).some((p) => p?.url === url));
  if (!owns) return notFound();

  const blob = await fetchPortfolioBlob(url);
  if (!blob) return notFound();

  return new NextResponse(new Uint8Array(blob.bytes), {
    headers: {
      'Content-Type': blob.contentType,
      'Cache-Control': 'private, no-store',
    },
  });
}
