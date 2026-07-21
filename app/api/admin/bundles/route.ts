import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// BLD-532: staff authoring for course bundles / pathways. Requires settings.manage.
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'bundle';
const optPence = (v: unknown): number | null => { if (v === '' || v == null) return null; const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 ? n : null; };

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { db } = await import('@/lib/db');
  const { currentTenantId } = await import('@/lib/tenant');
  const tenantId = await currentTenantId();
  const ok = (extra: object = {}) => NextResponse.json({ ok: true, ...extra });
  const bad = (e = 'Bad request') => NextResponse.json({ ok: false, error: e }, { status: 400 });

  // Per-tenant unique slug — append a short suffix if taken.
  async function uniqueSlug(base: string, exceptId?: string): Promise<string> {
    let slug = slugify(base);
    for (let i = 0; i < 50; i++) {
      const clash = await db.courseBundle.findFirst({ where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } });
      if (!clash) return slug;
      slug = `${slugify(base)}-${Math.random().toString(36).slice(2, 5)}`;
    }
    return `${slugify(base)}-${Date.now().toString(36)}`;
  }

  switch (b.op) {
    case 'createBundle': {
      const title = str(b.title).slice(0, 160) || 'New bundle';
      const order = await db.courseBundle.count();
      const d = await db.courseBundle.create({ data: { tenantId, title, slug: await uniqueSlug(title), order } });
      return ok({ id: d.id });
    }
    case 'updateBundle': {
      if (!b.id) return bad();
      const title = str(b.title).slice(0, 160) || 'Bundle';
      const slug = await uniqueSlug(str(b.slug) || title, String(b.id));
      await db.courseBundle.update({ where: { id: String(b.id) }, data: { title, slug, summary: str(b.summary).slice(0, 300) || null, description: str(b.description).slice(0, 4000) || null, heroImage: str(b.heroImage).slice(0, 1000) || null, pricePence: optPence(b.pricePence), active: b.active === undefined ? true : !!b.active } });
      return ok({ slug });
    }
    case 'deleteBundle': {
      if (!b.id) return bad();
      await db.courseBundle.delete({ where: { id: String(b.id) } });
      return ok();
    }
    case 'addCourse': {
      if (!b.bundleId || !b.courseId) return bad();
      const exists = await db.courseBundleItem.findFirst({ where: { bundleId: String(b.bundleId), courseId: String(b.courseId) }, select: { id: true } });
      if (exists) return ok({ id: exists.id });
      const order = await db.courseBundleItem.count({ where: { bundleId: String(b.bundleId) } });
      const it = await db.courseBundleItem.create({ data: { tenantId, bundleId: String(b.bundleId), courseId: String(b.courseId), order } });
      return ok({ id: it.id });
    }
    case 'removeItem': {
      if (!b.id) return bad();
      await db.courseBundleItem.delete({ where: { id: String(b.id) } });
      return ok();
    }
    case 'reorderItems': {
      if (!Array.isArray(b.ids)) return bad();
      await Promise.all((b.ids as string[]).map((id, i) => db.courseBundleItem.update({ where: { id }, data: { order: i } }).catch(() => {})));
      return ok();
    }
  }
  return bad('Unknown op');
}
