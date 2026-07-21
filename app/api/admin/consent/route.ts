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
      // Never issue a retired form: a deactivated template must not be sendable
      // even though the picker hides them — the API must not trust the client.
      if (!template.active) return bad('That consent form is no longer available.');
      // The kind is derived from the template, NOT taken from the client: the
      // photo opt-out is a decline record, so it must never be issued or stored
      // as an affirmative treatment consent (or vice versa).
      const kind = template.key === 'photo_opt_out' ? 'photo_opt_out' : 'treatment';
      // Reuse an existing pending request for the same booking + form if present.
      const existing = await db.consentRequest.findFirst({ where: { bookingId: body.bookingId ?? undefined, templateKey: body.templateKey, kind, status: 'PENDING' } });
      const reqRow = existing ?? await db.consentRequest.create({
        data: {
          clientId: body.clientId, bookingId: body.bookingId ?? null, templateKey: body.templateKey,
          title: template.title, kind,
          createdBy: session.email, expiresAt: new Date(Date.now() + 30 * 86400000),
        },
      });
      if (!existing) await logAudit({ action: 'CONSENT_REQUESTED', actor: session.email, actorRole: session.role, clientId: body.clientId, bookingId: body.bookingId ?? undefined, summary: `Issued consent “${template.title}”` });
      if (body.bookingId) revalidatePath(`/admin/bookings/${body.bookingId}`);
      return ok({ token: reqRow.token, url: `${site.url.replace(/\/$/, '')}/sign/${reqRow.token}` });
    }
    case 'emailRequest': {
      // Email the private signing link for an existing pending request straight to
      // the client (BLD-505). The token identifies the form + client + appointment.
      const session = await requirePermission('bookings.manage');
      if (!session) return bad('Not permitted.');
      if (!body.token) return bad();
      const reqRow = await db.consentRequest.findUnique({ where: { token: String(body.token) }, select: { token: true, title: true, clientId: true, bookingId: true, status: true } });
      if (!reqRow) return bad('That signing request could not be found.');
      if (reqRow.status !== 'PENDING') return bad('This form has already been signed.');
      const client = await db.client.findUnique({ where: { id: reqRow.clientId }, select: { firstName: true, email: true } });
      if (!client?.email) return bad('This client has no email address on file.');
      const { sendEmail, tmplConsentRequest } = await import('@/lib/email');
      const url = `${site.url.replace(/\/$/, '')}/sign/${reqRow.token}`;
      const res = await sendEmail({
        to: client.email,
        subject: 'Please sign your consent form — KClinics',
        html: tmplConsentRequest({ firstName: client.firstName || 'there', formTitle: reqRow.title, url }),
      });
      if (!res.ok) return bad(res.error || 'The email could not be sent. Please try again or copy the link.');
      await logAudit({ action: 'CONSENT_REQUESTED', actor: session.email, actorRole: session.role, clientId: reqRow.clientId, bookingId: reqRow.bookingId ?? undefined, summary: `Emailed consent “${reqRow.title}” to client` });
      return ok();
    }
    default:
      return bad('Unknown operation');
  }
}
