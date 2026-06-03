import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Capture a pre-treatment "before" photo (laser). Encrypted at rest; never
// stored on the device. Requires bookings.manage + a clinician attestation that
// the image is of a non-intimate treatment area.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('bookings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const dataUrl = String(body.dataUrl || '');
  if (!body.bookingId) return NextResponse.json({ ok: false, error: 'Missing booking.' }, { status: 400 });
  if (body.attest !== true) return NextResponse.json({ ok: false, error: 'You must confirm the non-intimate-area attestation.' }, { status: 400 });
  if (!dataUrl.startsWith('data:image/') || dataUrl.length > 4_000_000) return NextResponse.json({ ok: false, error: 'Invalid image.' }, { status: 400 });

  const { db } = await import('@/lib/db');
  const booking = await db.booking.findUnique({ where: { id: body.bookingId }, select: { id: true, clientId: true } });
  if (!booking) return NextResponse.json({ ok: false, error: 'Booking not found.' }, { status: 404 });

  const { encryptJson } = await import('@/lib/crypto');
  const photo = await db.beforePhoto.create({
    data: {
      bookingId: booking.id, clientId: booking.clientId, area: body.area ? String(body.area).slice(0, 80) : null,
      dataEnc: encryptJson(dataUrl), capturedBy: session.email, attestation: true,
    },
  });
  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'BEFORE_PHOTO_CAPTURED', actor: session.email, actorRole: session.role, bookingId: booking.id, clientId: booking.clientId, summary: `Before photo captured${body.area ? ` (${body.area})` : ''}` });
  revalidatePath(`/admin/bookings/${booking.id}`);
  return NextResponse.json({ ok: true, id: photo.id });
}

// DELETE ?id= — remove a photo (mistake/wrong area). Requires bookings.manage.
export async function DELETE(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('bookings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });
  const { db } = await import('@/lib/db');
  const p = await db.beforePhoto.findUnique({ where: { id }, select: { bookingId: true, clientId: true } });
  await db.beforePhoto.delete({ where: { id } }).catch(() => {});
  if (p) {
    const { logAudit } = await import('@/lib/audit');
    await logAudit({ action: 'BEFORE_PHOTO_CAPTURED', actor: session.email, actorRole: session.role, bookingId: p.bookingId, clientId: p.clientId, summary: 'Before photo deleted' });
    revalidatePath(`/admin/bookings/${p.bookingId}`);
  }
  return NextResponse.json({ ok: true });
}
