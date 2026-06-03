import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Manage dynamic QR codes (create, re-point destination, enable/disable, delete).
// Requires settings.manage.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');
  const { logAudit } = await import('@/lib/audit');
  const { randomCode, slugifyCode } = await import('@/lib/qr');

  const ok = () => NextResponse.json({ ok: true });
  const bad = (error = 'Bad request') => NextResponse.json({ ok: false, error }, { status: 400 });
  const cleanDest = (d: unknown) => String(d ?? '').trim().slice(0, 500);

  switch (body.op) {
    case 'create': {
      const label = String(body.label ?? '').trim().slice(0, 120);
      const destination = cleanDest(body.destination);
      if (!label || !destination) return bad('Name and destination are required.');
      // Use the requested slug if free, else fall back to a random one.
      let code = body.code ? slugifyCode(String(body.code)) : randomCode();
      if (!code) code = randomCode();
      if (await db.qrCode.findUnique({ where: { code } })) {
        if (body.code) return bad('That code is already in use — choose another.');
        code = randomCode(8);
      }
      const created = await db.qrCode.create({ data: { code, label, destination, notes: body.notes ? String(body.notes).slice(0, 500) : null, createdBy: session.email } });
      await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Created QR code “${label}” (/qr/${code})` });
      revalidatePath('/admin/qr');
      return NextResponse.json({ ok: true, id: created.id, code });
    }
    case 'update': {
      if (!body.id) return bad();
      const existing = await db.qrCode.findUnique({ where: { id: body.id } });
      if (!existing) return bad('Not found');
      // Allow re-pointing the destination and editing label/notes/active. The
      // slug can be changed too, but only to a free one (this changes the URL,
      // so it would need a reprint — guarded with a uniqueness check).
      let code = existing.code;
      if (body.code !== undefined) {
        const next = slugifyCode(String(body.code));
        if (!next) return bad('Invalid code.');
        if (next !== existing.code && (await db.qrCode.findUnique({ where: { code: next } }))) return bad('That code is already in use.');
        code = next;
      }
      await db.qrCode.update({
        where: { id: body.id },
        data: {
          code,
          ...(body.label !== undefined ? { label: String(body.label).trim().slice(0, 120) } : {}),
          ...(body.destination !== undefined ? { destination: cleanDest(body.destination) } : {}),
          ...(body.notes !== undefined ? { notes: body.notes ? String(body.notes).slice(0, 500) : null } : {}),
          ...(typeof body.active === 'boolean' ? { active: body.active } : {}),
        },
      });
      await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Updated QR code “${existing.label}” (/qr/${code})` });
      revalidatePath('/admin/qr');
      return ok();
    }
    case 'remove': {
      if (!body.id) return bad();
      const existing = await db.qrCode.findUnique({ where: { id: body.id } });
      if (!existing) return bad('Not found');
      await db.qrCode.delete({ where: { id: body.id } });
      await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Deleted QR code “${existing.label}” (/qr/${existing.code})` });
      revalidatePath('/admin/qr');
      return ok();
    }
    default:
      return bad('Unknown operation');
  }
}
