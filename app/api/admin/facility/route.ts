import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PRJ-63 — facility knowledge base API. Upload/list/delete plans, equipment guides
// and instructions (images or PDFs) backed by Vercel Blob. View is broad
// (facility.view); creating/removing needs facility.manage.
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB (plans/PDFs can be large)
const OK_MIME = /^(image\/(png|jpe?g|webp|gif|avif)|application\/pdf)$/i;
const TYPES = ['FLOOR_PLAN', 'ELECTRICAL', 'PLUMBING', 'EQUIPMENT', 'INSTRUCTION', 'OTHER'];

async function guard(perm: 'facility.view' | 'facility.manage') {
  if (!crmEnabled) return { error: NextResponse.json({ ok: false }, { status: 503 }) };
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission(perm);
  if (!session) return { error: NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 }) };
  return { session };
}

export async function GET() {
  const g = await guard('facility.view'); if (g.error) return g.error;
  const { db } = await import('@/lib/db');
  try {
    const docs = await db.facilityDoc.findMany({ orderBy: [{ type: 'asc' }, { order: 'asc' }, { createdAt: 'desc' }] });
    return NextResponse.json({ ok: true, docs });
  } catch {
    return NextResponse.json({ ok: true, docs: [], tableMissing: true });
  }
}

export async function POST(req: Request) {
  const g = await guard('facility.manage'); if (g.error) return g.error;
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ ok: false, error: 'File storage isn’t connected yet. Add a Vercel Blob store (Storage → Create → Blob), then redeploy.' }, { status: 400 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: 'No file.' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: 'File is over 20 MB.' }, { status: 413 });
  if (file.type && !OK_MIME.test(file.type)) return NextResponse.json({ ok: false, error: 'Only images or PDFs are allowed.' }, { status: 415 });

  const title = String(form?.get('title') || '').trim().slice(0, 160) || (file.name || 'Document');
  const typeRaw = String(form?.get('type') || 'OTHER');
  const type = TYPES.includes(typeRaw) ? typeRaw : 'OTHER';
  const description = String(form?.get('description') || '').trim().slice(0, 1000) || null;
  const locationId = String(form?.get('locationId') || '').trim() || null;
  const tags = String(form?.get('tags') || '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 12);
  const isPdf = /pdf/i.test(file.type) || /\.pdf$/i.test(file.name || '');
  const safe = (file.name || 'file').replace(/[^a-zA-Z0-9.\-_]/g, '-').slice(0, 80);
  const key = `facility/${type.toLowerCase()}/${Date.now().toString(36)}-${safe}`;

  try {
    const { put } = await import('@vercel/blob');
    const blob = await put(key, file, { access: 'public', addRandomSuffix: false, contentType: file.type || undefined });
    const { db } = await import('@/lib/db');
    const doc = await db.facilityDoc.create({
      data: { title, type: type as never, fileUrl: blob.url, isPdf, description, locationId, tags, createdBy: (g.session as { email?: string })?.email ?? null },
    });
    return NextResponse.json({ ok: true, doc });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error)?.message || 'Upload failed.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const g = await guard('facility.manage'); if (g.error) return g.error;
  const { id } = await req.json().catch(() => ({ id: '' }));
  if (!id) return NextResponse.json({ ok: false, error: 'No id.' }, { status: 400 });
  const { db } = await import('@/lib/db');
  const doc = await db.facilityDoc.findUnique({ where: { id: String(id) } });
  if (!doc) return NextResponse.json({ ok: true });
  try { const { del } = await import('@vercel/blob'); await del(doc.fileUrl); } catch { /* blob may already be gone */ }
  await db.facilityDoc.delete({ where: { id: String(id) } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
