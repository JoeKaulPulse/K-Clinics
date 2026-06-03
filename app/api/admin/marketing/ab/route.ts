import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Manage A/B tests + variants. Requires campaigns.send.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = (await requirePermission('campaigns.send')) || (await requirePermission('settings.manage'));
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');
  const { slugify } = await import('@/lib/marketing');
  const ok = (d: object = {}) => NextResponse.json({ ok: true, ...d });
  const bad = (e = 'Bad request') => NextResponse.json({ ok: false, error: e }, { status: 400 });
  const refresh = () => revalidatePath('/admin/marketing/ab');

  switch (body.op) {
    case 'createTest': {
      const name = String(body.name ?? '').trim().slice(0, 120);
      if (!name) return bad('Name required.');
      let slug = slugify(body.slug || name) || `test-${Date.now().toString(36)}`;
      if (await db.abTest.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
      const t = await db.abTest.create({
        data: {
          name, slug, createdBy: session.email,
          variants: { create: [
            { key: 'A', label: 'Control', weight: 1 },
            { key: 'B', label: 'Variant B', weight: 1 },
          ] },
        },
      });
      refresh();
      return ok({ id: t.id, slug });
    }
    case 'updateTest': {
      if (!body.id) return bad();
      const data: Record<string, unknown> = {};
      if (body.name !== undefined) data.name = String(body.name).slice(0, 120);
      if (body.status && ['DRAFT', 'RUNNING', 'STOPPED'].includes(body.status)) data.status = body.status;
      await db.abTest.update({ where: { id: body.id }, data });
      refresh();
      return ok();
    }
    case 'removeTest': {
      if (!body.id) return bad();
      await db.abTest.delete({ where: { id: body.id } }).catch(() => {});
      refresh();
      return ok();
    }
    case 'addVariant': {
      if (!body.testId) return bad();
      const count = await db.abVariant.count({ where: { testId: body.testId } });
      const key = String.fromCharCode(65 + count); // A, B, C…
      await db.abVariant.create({ data: { testId: body.testId, key, label: `Variant ${key}`, weight: 1 } });
      refresh();
      return ok();
    }
    case 'updateVariant': {
      if (!body.id) return bad();
      const data: Record<string, unknown> = {};
      for (const f of ['label', 'headline', 'subhead', 'ctaLabel', 'ctaHref'] as const) {
        if (body[f] !== undefined) data[f] = body[f] === '' ? null : String(body[f]).slice(0, 300);
      }
      if (body.weight !== undefined) data.weight = Math.max(0, Math.round(Number(body.weight) || 0));
      await db.abVariant.update({ where: { id: body.id }, data });
      refresh();
      return ok();
    }
    case 'removeVariant': {
      if (!body.id) return bad();
      await db.abVariant.delete({ where: { id: body.id } }).catch(() => {});
      refresh();
      return ok();
    }
    default:
      return bad('Unknown operation');
  }
}
