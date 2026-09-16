import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { crmEnabled } from '@/lib/crm';
import { fetchVtctBlob, isVtctBlobUrl } from '@/lib/vtct-blob';

export const runtime = 'nodejs';

// BLD-1794: VTCT registration documents are identity documents (Photo ID,
// Proof of Address, prior qualification certs), stored PRIVATE on Vercel Blob.
// This relay is the only read path — mirrors /api/academy/portfolio/photo
// (BLD-740): the requester must be the trainee who owns the registration, or
// signed-in staff (settings.manage — the same permission that gates the
// academy admin student profile). Everything else — including probes for URLs
// that do exist — gets the same 404, and the file streams with no-store
// headers plus a download disposition so it never lands in a shared cache or
// renders inline in a way that could be screenshotted from a shared screen.
const notFound = () => NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const url = new URL(req.url).searchParams.get('u') || '';
  if (!isVtctBlobUrl(url)) return notFound(); // never proxy arbitrary URLs

  // Trainee first (own registration only), then staff (any registration — review surface).
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  let allowed = false;
  let filename = 'document';
  if (student) {
    const doc = await db.vtctRegistrationDocument.findFirst({ where: { url, registration: { studentId: student.id } }, select: { filename: true } });
    if (doc) { allowed = true; filename = doc.filename; }
  }
  if (!allowed) {
    const { getSession, sessionCan } = await import('@/lib/auth');
    const session = await getSession();
    if (session && sessionCan(session, 'settings.manage')) {
      const doc = await db.vtctRegistrationDocument.findFirst({ where: { url }, select: { filename: true } });
      if (doc) { allowed = true; filename = doc.filename; }
    }
  }
  if (!allowed) return notFound();

  const blob = await fetchVtctBlob(url);
  if (!blob) return notFound();

  const safeName = filename.replace(/[^A-Za-z0-9._-]+/g, '-').slice(-150) || 'document';
  return new NextResponse(new Uint8Array(blob.bytes), {
    headers: {
      'Content-Type': blob.contentType,
      'Content-Disposition': `inline; filename="${safeName}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
