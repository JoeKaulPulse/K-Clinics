import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';
import { site } from '@/lib/site';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const body = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');
  const { logAudit } = await import('@/lib/audit');
  const ok = (d: object = {}) => NextResponse.json({ ok: true, ...d });
  const bad = (e = 'Bad request') => NextResponse.json({ ok: false, error: e }, { status: 400 });

  switch (body.op) {
    case 'updateTemplate': {
      const session = await requirePermission('settings.manage');
      if (!session) return bad('Not permitted.');
      if (!body.key) return bad();
      const existing = await db.consentTemplate.findUnique({ where: { key: body.key } });
      if (!existing) return bad('Not found');
      const bodyChanged = body.bodyMd !== undefined && body.bodyMd !== existing.bodyMd;
      const acks = Array.isArray(body.acknowledgements) ? body.acknowledgements.map((a: string) => String(a).slice(0, 300)).filter(Boolean) : undefined;
      const acksChanged = acks && JSON.stringify(acks) !== JSON.stringify(existing.acknowledgements);
      const strList = (v: unknown) => Array.isArray(v) ? Array.from(new Set(v.map((s) => String(s).trim()).filter(Boolean))).slice(0, 200) : undefined;
      const serviceSlugs = strList(body.serviceSlugs);
      const serviceGroups = strList(body.serviceGroups);
      await db.consentTemplate.update({
        where: { key: body.key },
        data: {
          ...(body.title !== undefined ? { title: String(body.title).slice(0, 160) } : {}),
          ...(body.category !== undefined ? { category: String(body.category).slice(0, 40) } : {}),
          ...(body.bodyMd !== undefined ? { bodyMd: String(body.bodyMd).slice(0, 20000) } : {}),
          ...(acks ? { acknowledgements: acks } : {}),
          ...(serviceSlugs ? { serviceSlugs } : {}),
          ...(serviceGroups ? { serviceGroups } : {}),
          ...(typeof body.active === 'boolean' ? { active: body.active } : {}),
          ...(bodyChanged || acksChanged ? { version: { increment: 1 } } : {}),
          updatedBy: session.email,
        },
      });
      await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Edited consent template “${existing.title}”${bodyChanged || acksChanged ? ' (new version)' : ''}` });
      revalidatePath('/admin/consent');
      return ok();
    }
    case 'createTemplate': {
      const session = await requirePermission('settings.manage');
      if (!session) return bad('Not permitted.');
      const title = String(body.title || '').trim().slice(0, 160);
      if (!title) return bad('A title is required.');
      // Key: caller-supplied or slugified from the title; must be unique + safe.
      const key = String(body.key || title).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
      if (!key) return bad('Could not derive a code from the title.');
      const clash = await db.consentTemplate.findUnique({ where: { key }, select: { id: true } });
      if (clash) return bad(`A form with code “${key}” already exists — choose a different name.`);
      const strList = (v: unknown) => Array.isArray(v) ? Array.from(new Set(v.map((s) => String(s).trim()).filter(Boolean))).slice(0, 200) : [];
      const acks = Array.isArray(body.acknowledgements) ? body.acknowledgements.map((a: string) => String(a).slice(0, 300)).filter(Boolean) : [];
      await db.consentTemplate.create({
        data: {
          key, title,
          category: String(body.category || 'general').slice(0, 40),
          bodyMd: String(body.bodyMd || '').slice(0, 20000),
          acknowledgements: acks,
          serviceSlugs: strList(body.serviceSlugs),
          serviceGroups: strList(body.serviceGroups),
          active: body.active === false ? false : true,
          updatedBy: session.email,
        },
      });
      await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Created consent form “${title}” (${key})` });
      revalidatePath('/admin/consent');
      return ok({ key });
    }
    case 'createRequest': {
      const session = await requirePermission('bookings.manage');
      if (!session) return bad('Not permitted.');
      if (!body.clientId || !body.templateKey) return bad();
      const template = await db.consentTemplate.findUnique({ where: { key: body.templateKey } });
      if (!template) return bad('Template not found');
      // Reuse an existing pending request for the same booking+template if present.
      const existing = await db.consentRequest.findFirst({ where: { bookingId: body.bookingId ?? undefined, templateKey: body.templateKey, status: 'PENDING' } });
      const reqRow = existing ?? await db.consentRequest.create({
        data: {
          clientId: body.clientId, bookingId: body.bookingId ?? null, templateKey: body.templateKey,
          title: template.title, kind: body.kind === 'photo_opt_out' ? 'photo_opt_out' : 'treatment',
          createdBy: session.email, expiresAt: new Date(Date.now() + 30 * 86400000),
        },
      });
      if (!existing) await logAudit({ action: 'CONSENT_REQUESTED', actor: session.email, actorRole: session.role, clientId: body.clientId, bookingId: body.bookingId ?? undefined, summary: `Issued consent “${template.title}”` });
      if (body.bookingId) revalidatePath(`/admin/bookings/${body.bookingId}`);
      return ok({ token: reqRow.token, url: `${site.url.replace(/\/$/, '')}/sign/${reqRow.token}` });
    }
    default:
      return bad('Unknown operation');
  }
}
