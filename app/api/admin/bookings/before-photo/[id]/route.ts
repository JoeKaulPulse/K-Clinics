import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Serve a decrypted before-photo to authorised clinical staff only. The image
// never has a public URL and is decrypted on demand behind this gate.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!crmEnabled) return new NextResponse('Disabled', { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = (await requirePermission('clients.clinical.view')) || (await requirePermission('bookings.manage'));
  if (!session) return new NextResponse('Forbidden', { status: 403 });

  const { id } = await params;
  const { db } = await import('@/lib/db');
  const row = await db.beforePhoto.findUnique({ where: { id }, select: { dataEnc: true } });
  if (!row) return new NextResponse('Not found', { status: 404 });

  try {
    const { decryptJson } = await import('@/lib/crypto');
    const dataUrl = decryptJson<string>(row.dataEnc);
    const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl);
    if (!m) return new NextResponse('Bad image', { status: 422 });
    const buf = Buffer.from(m[2], 'base64');
    return new NextResponse(buf, { headers: { 'content-type': m[1], 'cache-control': 'private, no-store' } });
  } catch {
    return new NextResponse('Decrypt failed', { status: 500 });
  }
}
