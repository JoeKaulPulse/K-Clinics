import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { InventoryManager } from '@/components/admin/InventoryManager';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'inventory.view')) redirect('/admin');
  const canManage = sessionCan(session, 'inventory.manage');

  const { db } = await import('@/lib/db');
  const [itemsRaw, expiringRaw] = await Promise.all([
    db.stockItem.findMany({ where: { active: true }, orderBy: [{ category: 'asc' }, { name: 'asc' }] }),
    db.stockMovement.findMany({
      where: { reason: 'RECEIVED', expiry: { not: null, gte: new Date() } },
      orderBy: { expiry: 'asc' },
      take: 40,
      include: { item: { select: { name: true, unit: true } } },
    }),
  ]);

  const items = itemsRaw.map((i) => ({
    id: i.id, name: i.name, category: i.category, unit: i.unit, sku: i.sku, supplier: i.supplier,
    currentQty: i.currentQty, lowStockAt: i.lowStockAt, costPence: i.costPence,
  }));

  const soon = new Date(Date.now() + 90 * 864e5);
  const expiring = expiringRaw
    .filter((m) => m.expiry && m.expiry <= soon)
    .map((m) => ({ id: m.id, itemName: m.item.name, unit: m.item.unit, batchNo: m.batchNo, expiry: m.expiry!.toISOString(), qty: m.delta }));

  const can = await sessionPermissions();
  const locale = await getLocale();
  const uk = locale === 'uk';

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">{uk ? 'Склад і запаси' : 'Inventory'}</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">
        {uk ? 'Облік витратних матеріалів — рівні запасів, партії, терміни придатності та сповіщення про низький залишок.' : 'Track consumables — stock levels, batches, expiry dates and low-stock alerts.'}
      </p>
      <div className="mt-8">
        <InventoryManager items={items} expiring={expiring} canManage={canManage} uk={uk} />
      </div>
    </AdminShell>
  );
}
