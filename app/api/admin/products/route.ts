import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Manage retail products + inventory. Requires settings.manage.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');
  const { slugifyProduct } = await import('@/lib/products');
  const { logAudit } = await import('@/lib/audit');
  const ok = (d: object = {}) => NextResponse.json({ ok: true, ...d });
  const bad = (e = 'Bad request') => NextResponse.json({ ok: false, error: e }, { status: 400 });
  const pence = (v: unknown) => (v == null || v === '' ? null : Math.max(0, Math.round(Number(v) * 100)));
  const int = (v: unknown) => (v == null || v === '' ? 0 : Math.max(0, Math.round(Number(v))));

  switch (body.op) {
    case 'create': {
      const name = String(body.name ?? '').trim().slice(0, 160);
      if (!name) return bad('Name is required.');
      let slug = slugifyProduct(body.slug || name) || `product-${Date.now().toString(36)}`;
      if (await db.product.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
      const p = await db.product.create({ data: { name, slug, pricePence: pence(body.price) ?? 0, createdBy: session.email } });
      await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Created product “${name}”` });
      revalidatePath('/admin/products');
      return ok({ id: p.id });
    }
    case 'update': {
      if (!body.id) return bad();
      const data: Record<string, unknown> = {};
      if (body.name !== undefined) data.name = String(body.name).slice(0, 160);
      if (body.description !== undefined) data.description = body.description ? String(body.description).slice(0, 4000) : null;
      if (body.brand !== undefined) data.brand = body.brand ? String(body.brand).slice(0, 80) : null;
      if (body.category !== undefined) data.category = body.category ? String(body.category).slice(0, 80) : null;
      if (body.price !== undefined) data.pricePence = pence(body.price) ?? 0;
      if (body.compareAt !== undefined) data.compareAtPence = pence(body.compareAt);
      if (body.cost !== undefined) data.costPence = pence(body.cost);
      if (body.sku !== undefined) data.sku = body.sku ? String(body.sku).slice(0, 60) : null;
      if (body.barcode !== undefined) data.barcode = body.barcode ? String(body.barcode).slice(0, 60) : null;
      if (Array.isArray(body.images)) data.images = body.images.map((s: string) => String(s).slice(0, 500)).filter(Boolean).slice(0, 8);
      if (body.status && ['DRAFT', 'ACTIVE', 'ARCHIVED'].includes(body.status)) data.status = body.status;
      if (typeof body.ageRestricted === 'boolean') data.ageRestricted = body.ageRestricted;
      if (typeof body.trackInventory === 'boolean') data.trackInventory = body.trackInventory;
      if (body.stockQty !== undefined) data.stockQty = int(body.stockQty);
      if (body.lowStockThreshold !== undefined) data.lowStockThreshold = int(body.lowStockThreshold);
      await db.product.update({ where: { id: body.id }, data });
      revalidatePath('/admin/products');
      revalidatePath(`/admin/products/${body.id}`);
      return ok();
    }
    case 'adjustStock': {
      if (!body.id) return bad();
      const delta = Math.round(Number(body.delta) || 0);
      const p = await db.product.findUnique({ where: { id: body.id }, select: { stockQty: true, name: true } });
      if (!p) return bad('Not found');
      const next = Math.max(0, p.stockQty + delta);
      await db.product.update({ where: { id: body.id }, data: { stockQty: next } });
      await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Stock for “${p.name}”: ${delta > 0 ? '+' : ''}${delta} → ${next}` });
      revalidatePath('/admin/products');
      return ok({ stockQty: next });
    }
    case 'remove': {
      if (!body.id) return bad();
      await db.product.delete({ where: { id: body.id } }).catch(() => {});
      revalidatePath('/admin/products');
      return ok();
    }
    default:
      return bad('Unknown operation');
  }
}
