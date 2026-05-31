import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

const REASONS = ['RECEIVED', 'USED', 'WASTED', 'RETURNED', 'ADJUSTMENT'];

// Inventory management. Reads require inventory.view; writes inventory.manage.
//   POST { op: 'createItem' | 'updateItem' | 'archiveItem' | 'move' }
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('inventory.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');

  if (body.op === 'createItem') {
    const { name, category, brand, size, unit, sku, supplier, moq, lowStockAt, costPence, retailPence, isRetail } = body as Record<string, string | number | boolean | undefined>;
    if (!name || typeof name !== 'string' || !name.trim()) return NextResponse.json({ ok: false, error: 'A name is required.' }, { status: 400 });
    const item = await db.stockItem.create({
      data: {
        name: name.trim().slice(0, 160),
        category: (category as string)?.trim() || null,
        brand: (brand as string)?.trim() || null,
        size: (size as string)?.trim() || null,
        unit: ((unit as string) || 'unit').trim().slice(0, 24),
        sku: (sku as string)?.trim() || null,
        supplier: (supplier as string)?.trim() || null,
        moq: Math.max(1, Math.round(Number(moq)) || 1),
        lowStockAt: Number(lowStockAt) || 0,
        costPence: costPence != null && costPence !== '' ? Math.round(Number(costPence)) : null,
        retailPence: retailPence != null && retailPence !== '' ? Math.round(Number(retailPence)) : null,
        isRetail: Boolean(isRetail),
      },
    });
    return NextResponse.json({ ok: true, id: item.id });
  }

  if (body.op === 'updateItem') {
    const { id, name, category, brand, size, unit, sku, supplier, moq, lowStockAt, costPence, retailPence, isRetail, active } = body as Record<string, string | number | boolean | undefined>;
    if (!id) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
    await db.stockItem.update({
      where: { id: id as string },
      data: {
        ...(name !== undefined ? { name: String(name).trim().slice(0, 160) } : {}),
        ...(category !== undefined ? { category: String(category).trim() || null } : {}),
        ...(brand !== undefined ? { brand: String(brand).trim() || null } : {}),
        ...(size !== undefined ? { size: String(size).trim() || null } : {}),
        ...(unit !== undefined ? { unit: String(unit).trim().slice(0, 24) || 'unit' } : {}),
        ...(sku !== undefined ? { sku: String(sku).trim() || null } : {}),
        ...(supplier !== undefined ? { supplier: String(supplier).trim() || null } : {}),
        ...(moq !== undefined ? { moq: Math.max(1, Math.round(Number(moq)) || 1) } : {}),
        ...(lowStockAt !== undefined ? { lowStockAt: Number(lowStockAt) || 0 } : {}),
        ...(costPence !== undefined ? { costPence: costPence === '' || costPence == null ? null : Math.round(Number(costPence)) } : {}),
        ...(retailPence !== undefined ? { retailPence: retailPence === '' || retailPence == null ? null : Math.round(Number(retailPence)) } : {}),
        ...(typeof isRetail === 'boolean' ? { isRetail } : {}),
        ...(typeof active === 'boolean' ? { active } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.op === 'archiveItem') {
    const { id } = body as { id?: string };
    if (!id) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
    await db.stockItem.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ ok: true });
  }

  // Record a stock movement and adjust the running quantity atomically.
  if (body.op === 'move') {
    const { itemId, qty, reason, batchNo, expiry, note } = body as {
      itemId?: string; qty?: number; reason?: string; batchNo?: string; expiry?: string; note?: string;
    };
    if (!itemId || !qty || isNaN(Number(qty)) || Number(qty) <= 0) return NextResponse.json({ ok: false, error: 'Enter a quantity.' }, { status: 400 });
    const r = REASONS.includes(reason || '') ? (reason as string) : 'ADJUSTMENT';
    // RECEIVED adds; everything else removes (ADJUSTMENT can be signed via reason choice — kept simple: USED/WASTED/RETURNED subtract).
    const signed = r === 'RECEIVED' ? Math.abs(Number(qty)) : r === 'ADJUSTMENT' ? Number(qty) : -Math.abs(Number(qty));
    const [, item] = await db.$transaction([
      db.stockMovement.create({
        data: {
          itemId, delta: signed, reason: r as never,
          batchNo: batchNo?.trim() || null,
          expiry: expiry && !isNaN(Date.parse(expiry)) ? new Date(expiry) : null,
          note: note?.trim().slice(0, 300) || null,
          by: session.email,
        },
      }),
      db.stockItem.update({ where: { id: itemId }, data: { currentQty: { increment: signed } } }),
    ]);
    return NextResponse.json({ ok: true, currentQty: item.currentQty });
  }

  return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
}
