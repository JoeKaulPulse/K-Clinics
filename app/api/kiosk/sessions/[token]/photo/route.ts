import { NextResponse, after } from 'next/server';
import { db } from '@/lib/db';
import { logKioskEvent, runKioskAnalysis } from '@/lib/kiosk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX = 10 * 1024 * 1024; // 10MB
const OK = /^image\/(png|jpe?g|webp|heic|heif)$/i;

// Public. Accepts the visitor's selfie, stores it on Vercel Blob, records
// consent, then kicks off (fire-and-forget) the AI analysis so the client can
// poll the status endpoint. Returns immediately.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const session = await db.kioskSession.findUnique({ where: { token } });
  if (!session) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

  // Reject expired/finished sessions.
  if (session.status === 'EXPIRED' || session.expiresAt < new Date()) {
    if (session.status !== 'EXPIRED') {
      await db.kioskSession.update({ where: { id: session.id }, data: { status: 'EXPIRED' } }).catch(() => {});
    }
    return NextResponse.json({ ok: false, error: 'expired' }, { status: 410 });
  }
  // Allow a retry if the previous analysis failed; otherwise reject duplicate uploads.
  if (session.photoUrl && session.status !== 'ANALYSIS_FAILED') {
    return NextResponse.json({ ok: false, error: 'already_submitted' }, { status: 409 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const consent = form?.get('consent');
  if (consent !== 'true') return NextResponse.json({ ok: false, error: 'Consent is required.' }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: 'No photo.' }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ ok: false, error: 'Photo is over 10 MB.' }, { status: 413 });
  if (file.type && !OK.test(file.type)) return NextResponse.json({ ok: false, error: 'Images only (PNG/JPG/WebP/HEIC).' }, { status: 415 });

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ ok: false, error: 'Photo storage isn’t connected.' }, { status: 503 });
  }

  let blobUrl: string;
  try {
    const { put } = await import('@vercel/blob');
    // Store with the correct extension so the AI step derives the right media
    // type (an iPhone HEIC stored as .jpg was being mislabelled image/jpeg).
    const ext = file.type === 'image/png' ? 'png'
      : file.type === 'image/webp' ? 'webp'
      : (file.type === 'image/heic' || file.type === 'image/heif') ? 'heic' : 'jpg';
    const blob = await put(`kiosk/${token}-${Date.now()}.${ext}`, file, {
      access: 'private',
      addRandomSuffix: false,
      contentType: file.type || 'image/jpeg',
    });
    blobUrl = blob.url;
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error)?.message || 'Upload failed.' }, { status: 500 });
  }

  await db.kioskSession.update({
    where: { id: session.id },
    data: { photoUrl: blobUrl, consentAt: new Date(), status: 'PHOTO_TAKEN' },
  });

  // Funnel events: consent + photo.
  await logKioskEvent('consent', session.id, session.ipHash);
  await logKioskEvent('photo', session.id, session.ipHash);

  // Run the analysis AFTER the response is sent, via `after()` — this keeps the
  // serverless function alive until it finishes (a plain fire-and-forget would be
  // frozen/killed once we respond, so the result would never be produced). The
  // client polls /api/kiosk/sessions/[token] for the result.
  after(async () => { await runKioskAnalysis(session.id).catch(() => {}); });

  return NextResponse.json({ ok: true });
}
