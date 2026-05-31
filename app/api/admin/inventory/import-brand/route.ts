import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';
import isClinical from '@/lib/data/is-clinical-supplier.json';

export const runtime = 'nodejs';

// Import a supplier brand's catalogue into inventory — honouring MOQ, wholesale
// cost, RRP and retail flag. Idempotent: matches on (brand, sku), updating
// catalogue fields but never overwriting on-hand quantity. Requires inventory.manage.
const CATALOGUES: Record<string, typeof isClinical> = { 'is-clinical': isClinical };

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('inventory.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const { brand } = await req.json().catch(() => ({}));
  const cat = CATALOGUES[brand as string] || isClinical;

  const { db } = await import('@/lib/db');
  let created = 0, updated = 0;
  for (const it of cat.items) {
    const data = {
      name: it.name,
      brand: cat.brand,
      category: it.category,
      size: it.size ?? null,
      unit: 'unit',
      sku: it.sku ?? null,
      supplier: cat.supplier,
      moq: it.moq ?? 1,
      costPence: it.wholesalePence ?? null,
      retailPence: it.rrpPence ?? null,
      isRetail: Boolean(it.isRetail),
      active: true,
    };
    const existing = it.sku
      ? await db.stockItem.findFirst({ where: { brand: cat.brand, sku: it.sku } })
      : await db.stockItem.findFirst({ where: { brand: cat.brand, name: it.name } });
    if (existing) {
      await db.stockItem.update({ where: { id: existing.id }, data }); // keep currentQty
      updated++;
    } else {
      await db.stockItem.create({ data: { ...data, currentQty: 0, lowStockAt: it.moq ?? 1 } });
      created++;
    }
  }
  return NextResponse.json({ ok: true, brand: cat.brand, created, updated, total: cat.items.length });
}
