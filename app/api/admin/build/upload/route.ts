import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';
import { verifiedFileMime } from '@/lib/security/file-type';

export const runtime = 'nodejs';

// Screenshot upload for problem reports — available to any staff who can use the
// board (build.view), unlike the settings-gated media library. Vercel Blob.
const MAX = 12 * 1024 * 1024;
const OK = /^image\/(png|jpe?g|webp|gif|avif|heic|heif)$/i; // incl. iPhone HEIC/HEIF

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('build.view');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ ok: false, error: 'Image storage isn’t connected (add a Vercel Blob store).' }, { status: 400 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: 'No file.' }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ ok: false, error: 'Image is over 12 MB.' }, { status: 413 });
  // PRJ-1191.11: verify against the actual bytes, not just the declared
  // Content-Type — this route only ever accepts images, every one of which
  // sniffFileMime fingerprints. Both a mismatch (a GIF declared image/png) and
  // an unrecognisable file (a script/HTML/SVG payload relabelled image/png,
  // which sniffs to nothing) come back empty and are rejected here.
  const mime = await verifiedFileMime(file);
  if (!mime || !OK.test(mime)) return NextResponse.json({ ok: false, error: 'Images only.' }, { status: 415 });

  try {
    const { put } = await import('@vercel/blob');
    const safe = (file.name || 'shot.png').replace(/[^a-zA-Z0-9.\-_]/g, '-').slice(0, 60);
    const blob = await put(`build/${Date.now().toString(36)}-${safe}`, file, { access: 'public', addRandomSuffix: false, contentType: mime });
    return NextResponse.json({ ok: true, url: blob.url });
  } catch (e) {
    console.error('[build/upload] failed', e);
    return NextResponse.json({ ok: false, error: (e as Error)?.message || 'Upload failed.' }, { status: 500 });
  }
}
