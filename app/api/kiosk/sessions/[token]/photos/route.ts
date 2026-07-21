import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logKioskEvent } from '@/lib/kiosk';
import { MAX_KIOSK_PHOTOS } from '@/lib/kiosk-live';
import { rateLimit } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Same validation envelope as the existing single-photo route.
const MAX = 10 * 1024 * 1024; // 10MB
const OK = /^image\/(png|jpe?g|webp|heic|heif)$/i;

// Public, token-scoped. Kiosk v2 multi-capture: accepts one pose photo per
// call (multipart `file` + `poseIdx`), uploads it to Blob and appends it to
// photoUrls (max 4). Also keeps photoUrl (first photo) for back-compat with the
// v1 single-photo flow. Analysis is NOT triggered here — the phone posts to
// /analyze once the visitor confirms their set at review.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // 4 poses + retakes is a normal session; anything past this is abuse.
  const rl = await rateLimit(`kiosk-photos:${token}`, 12, 600);
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });

  const session = await db.kioskSession.findUnique({ where: { token } });
  if (!session) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

  if (session.status === 'EXPIRED' || session.expiresAt < new Date()) {
    if (session.status !== 'EXPIRED') {
      await db.kioskSession.update({ where: { id: session.id }, data: { status: 'EXPIRED', stage: 'failed' } }).catch(() => {});
    }
    return NextResponse.json({ ok: false, error: 'expired' }, { status: 410 });
  }
  if (session.status === 'AGE_DECLINED') {
    return NextResponse.json({ ok: false, error: 'declined' }, { status: 410 });
  }
  if (session.photoUrls.length >= MAX_KIOSK_PHOTOS) {
    return NextResponse.json({ ok: false, error: 'max_photos', count: session.photoUrls.length }, { status: 409 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  // Consent normally happens at the consent stage (stage route stamps it); the
  // form field keeps the old direct-upload path working as a fallback.
  if (!session.consentAt && form?.get('consent') !== 'true') {
    return NextResponse.json({ ok: false, error: 'Consent is required.' }, { status: 400 });
  }
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: 'No photo.' }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ ok: false, error: 'Photo is over 10 MB.' }, { status: 413 });
  if (file.type && !OK.test(file.type)) return NextResponse.json({ ok: false, error: 'Images only (PNG/JPG/WebP/HEIC).' }, { status: 415 });

  const rawPose = Number(form?.get('poseIdx'));
  const poseIdx = Number.isFinite(rawPose)
    ? Math.max(0, Math.min(MAX_KIOSK_PHOTOS - 1, Math.round(rawPose)))
    : session.poseIdx;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ ok: false, error: 'Photo storage isn’t connected.' }, { status: 503 });
  }

  let blobUrl: string;
  try {
    const { put } = await import('@vercel/blob');
    // Correct extension so the AI step derives the right media type.
    const ext = file.type === 'image/png' ? 'png'
      : file.type === 'image/webp' ? 'webp'
      : (file.type === 'image/heic' || file.type === 'image/heif') ? 'heic' : 'jpg';
    const blob = await put(`kiosk/${token}-p${poseIdx}-${Date.now()}.${ext}`, file, {
      access: 'private',
      addRandomSuffix: false,
      contentType: file.type || 'image/jpeg',
    });
    blobUrl = blob.url;
  } catch (e) {
    // PRJ-1032.5: never surface the raw storage error to an anonymous visitor
    // (it can leak bucket names / infra detail). Log the detail, return generic.
    console.error('[kiosk] blob upload failed (photos):', (e as Error)?.message);
    try { const Sentry = await import('@sentry/nextjs'); Sentry.captureException(e, { tags: { area: 'kiosk-photos-upload' } }); } catch { /* Sentry optional */ }
    return NextResponse.json({ ok: false, error: 'Upload failed. Please try again.' }, { status: 500 });
  }

  await db.kioskSession.update({
    where: { id: session.id },
    data: {
      photoUrls: { push: blobUrl },
      // Back-compat: photoUrl mirrors the FIRST captured photo.
      ...(session.photoUrl ? {} : { photoUrl: blobUrl }),
      ...(session.consentAt ? {} : { consentAt: new Date() }),
      status: 'PHOTO_TAKEN',
    },
  });

  if (!session.consentAt) await logKioskEvent('consent', session.id, session.ipHash);
  await logKioskEvent('photo', session.id, session.ipHash);

  return NextResponse.json({ ok: true, count: session.photoUrls.length + 1 });
}
