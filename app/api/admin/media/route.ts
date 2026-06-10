import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Media library backed by Vercel Blob. Requires settings.manage and a
// BLOB_READ_WRITE_TOKEN (auto-set once a Blob store is connected in Vercel).
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
// BLD-130: SVG removed — stored-XSS vector if CSP ever weakens.
const OK_MIME = /^image\/(png|jpe?g|webp|gif|avif)$/i;

async function guard() {
  if (!crmEnabled) return { error: NextResponse.json({ ok: false }, { status: 503 }) };
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return { error: NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 }) };
  return { session };
}

export async function GET() {
  const g = await guard(); if (g.error) return g.error;
  const { db } = await import('@/lib/db');
  try {
    const assets = await db.mediaAsset.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    return NextResponse.json({ ok: true, assets });
  } catch {
    return NextResponse.json({ ok: true, assets: [], tableMissing: true });
  }
}

export async function POST(req: Request) {
  const g = await guard(); if (g.error) return g.error;
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ ok: false, error: 'Media storage isn’t connected yet. Add a Vercel Blob store to the project (Storage → Create → Blob), then redeploy.' }, { status: 400 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: 'No file.' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: 'Image is over 8 MB.' }, { status: 413 });
  if (file.type && !OK_MIME.test(file.type)) return NextResponse.json({ ok: false, error: 'Only image files are allowed.' }, { status: 415 });

  const alt = String(form?.get('alt') || '');
  const width = Number(form?.get('width')) || null;
  const height = Number(form?.get('height')) || null;
  const folder = String(form?.get('folder') || 'general').replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'general';
  const safe = (file.name || 'image').replace(/[^a-zA-Z0-9.\-_]/g, '-').slice(0, 80);
  const key = `${folder}/${Date.now().toString(36)}-${safe}`;

  try {
    const { put } = await import('@vercel/blob');
    const blob = await put(key, file, { access: 'public', addRandomSuffix: false, contentType: file.type || undefined });
    const { db } = await import('@/lib/db');
    const { session } = g;
    const asset = await db.mediaAsset.create({
      data: { url: blob.url, pathname: blob.pathname, filename: safe, alt: alt || null, mime: file.type || null, size: file.size, width, height, folder, createdBy: (session as { email?: string })?.email ?? null },
    });
    return NextResponse.json({ ok: true, asset });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error)?.message || 'Upload failed.' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const g = await guard(); if (g.error) return g.error;
  const { id, alt } = await req.json().catch(() => ({ id: '' }));
  if (!id) return NextResponse.json({ ok: false, error: 'No id.' }, { status: 400 });
  const { db } = await import('@/lib/db');
  await db.mediaAsset.update({ where: { id: String(id) }, data: { alt: String(alt ?? '').slice(0, 300) || null } }).catch(() => {});
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const g = await guard(); if (g.error) return g.error;
  const { id } = await req.json().catch(() => ({ id: '' }));
  if (!id) return NextResponse.json({ ok: false, error: 'No id.' }, { status: 400 });
  const { db } = await import('@/lib/db');
  const asset = await db.mediaAsset.findUnique({ where: { id: String(id) } });
  if (!asset) return NextResponse.json({ ok: true });
  try { const { del } = await import('@vercel/blob'); await del(asset.url); } catch { /* already gone */ }
  await db.mediaAsset.delete({ where: { id: asset.id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
