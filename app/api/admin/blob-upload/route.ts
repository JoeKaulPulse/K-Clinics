import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Shared server-side upload for admin features (team chat, academy lesson media,
// etc.). The browser POSTs multipart form-data to THIS same-origin route, and the
// server streams it to Vercel Blob with put(). This avoids the @vercel/blob CLIENT
// upload path (which goes cross-origin to vercel.com/api/blob and is blocked by
// CSP/CORS in the browser). Capped at the serverless body limit (~4.5 MB) — larger
// files fall back to the client-direct path on the caller side. The proven-reliable
// pattern (see BLD-407: "route normal photos through the server-side upload route").
const MAX = Math.floor(4.4 * 1024 * 1024); // stay under Vercel's ~4.5 MB body cap
const OK = /^(image\/(png|jpe?g|webp|gif|avif|heic|heif)|video\/(mp4|quicktime|webm|x-m4v|3gpp)|application\/(pdf|zip|msword|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)|vnd\.ms-excel)|text\/plain)$/i;

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'Not signed in.' }, { status: 403 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ ok: false, error: 'File storage isn’t connected (add a Vercel Blob store).' }, { status: 400 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const folder = (String(form?.get('folder') || 'uploads').replace(/[^a-zA-Z0-9/_-]/g, '').replace(/^\/+|\/+$/g, '').slice(0, 40)) || 'uploads';
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: 'No file received.' }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ ok: false, error: 'File is over 4.5 MB — use a smaller file or compress it.', tooLarge: true }, { status: 413 });
  if (file.type && !OK.test(file.type)) return NextResponse.json({ ok: false, error: 'That file type isn’t supported.' }, { status: 415 });

  try {
    const { put } = await import('@vercel/blob');
    const safe = (file.name || 'file').replace(/[^a-zA-Z0-9.\-_]/g, '-').replace(/-+/g, '-').slice(0, 80) || 'file';
    const blob = await put(`${folder}/${Date.now().toString(36)}-${safe}`, file, { access: 'public', addRandomSuffix: true, contentType: file.type || undefined });
    return NextResponse.json({ ok: true, url: blob.url, name: file.name, mime: file.type || null, size: file.size });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error)?.message || 'Upload failed.' }, { status: 400 });
  }
}
