import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchKioskBlob } from '@/lib/kiosk-blob';

export const runtime = 'nodejs';

// BLD-798: kiosk selfies are stored PRIVATE on Vercel Blob (they were public,
// unauthenticated URLs viewable by anyone for 30 days). This relay is the only
// read path: it authenticates the session token exactly like the sibling kiosk
// routes, refuses expired sessions, and streams the image with no-store
// headers so the face photo never lands in a shared cache.
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await db.kioskSession.findUnique({ where: { token }, select: { id: true, status: true, expiresAt: true, photoUrl: true, photoUrls: true } });
  if (!session) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  if (session.status === 'EXPIRED' || session.expiresAt < new Date()) {
    return NextResponse.json({ ok: false, error: 'expired' }, { status: 410 });
  }

  const urls = session.photoUrls?.length ? session.photoUrls : session.photoUrl ? [session.photoUrl] : [];
  const i = Math.max(0, Math.min(urls.length - 1, Number(new URL(req.url).searchParams.get('i')) || 0));
  const url = urls[i];
  if (!url) return NextResponse.json({ ok: false, error: 'no_photo' }, { status: 404 });

  const blob = await fetchKioskBlob(url);
  if (!blob) return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 404 });

  return new NextResponse(new Uint8Array(blob.bytes), {
    headers: {
      'Content-Type': blob.contentType,
      'Cache-Control': 'private, no-store',
    },
  });
}
