import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';
import { verifiedFileMime } from '@/lib/security/file-type';

export const runtime = 'nodejs';

// Shared server-side upload for admin features (team chat, academy lesson media,
// etc.). The browser POSTs multipart form-data to THIS same-origin route, and the
// server streams it to Vercel Blob with put(). This avoids the @vercel/blob CLIENT
// upload path (which goes cross-origin to vercel.com/api/blob and is blocked by
// CSP/CORS in the browser). Capped at the serverless body limit (~4.5 MB) — larger
// files fall back to the client-direct path on the caller side. (BLD-485)
const MAX = Math.floor(4.4 * 1024 * 1024); // stay under Vercel's ~4.5 MB body cap
const OK = /^(image\/(png|jpe?g|webp|gif|avif|heic|heif)|video\/(mp4|quicktime|webm|x-m4v|3gpp)|audio\/(mpeg|mp4|x-m4a|aac|wav|x-wav|webm|ogg)|application\/(pdf|zip|msword|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation)|vnd\.ms-excel|vnd\.ms-powerpoint)|text\/plain)$/i;

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ ok: false, error: 'File storage is not connected (add a Vercel Blob store).' }, { status: 400 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const folder = (String(form?.get('folder') || 'uploads').replace(/[^a-zA-Z0-9/_-]/g, '').replace(/^\/+|\/+$/g, '').slice(0, 40)) || 'uploads';
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: 'No file received.' }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ ok: false, error: 'File is over 4.5 MB — use a smaller file or compress it.', tooLarge: true }, { status: 413 });
  // PRJ-1191.11: verify the declared Content-Type against the actual bytes
  // wherever that's checkable (images + PDF — the common relabel-as-an-image
  // bypass) instead of trusting it outright. Anything declared or sniffed as
  // an image/PDF must have the magic bytes to match, so a script/HTML/SVG
  // payload labelled image/png is rejected too, not just a wrong image format;
  // video/audio/office-doc/zip types this module can't fingerprint still fall
  // back to the declared type, same as before.
  const mime = await verifiedFileMime(file);
  if (!mime || !OK.test(mime)) return NextResponse.json({ ok: false, error: 'That file type is not supported.' }, { status: 415 });

  try {
    const { put } = await import('@vercel/blob');
    const safe = (file.name || 'file').replace(/[^a-zA-Z0-9.\-_]/g, '-').replace(/-+/g, '-').slice(0, 80) || 'file';
    const blob = await put(`${folder}/${Date.now().toString(36)}-${safe}`, file, { access: 'public', addRandomSuffix: true, contentType: mime });
    return NextResponse.json({ ok: true, url: blob.url, name: file.name, mime, size: file.size });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error)?.message || 'Upload failed.' }, { status: 400 });
  }
}
