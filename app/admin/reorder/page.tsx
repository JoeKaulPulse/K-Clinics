import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { ReorderList } from '@/components/admin/ReorderList';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

const gbp = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function ReorderPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'inventory.view')) redirect('/admin');
  const canManage = sessionCan(session, 'inventory.manage');

  const { db } = await import('@/lib/db');
  const items = await db.stockItem.findMany({
    where: { active: true },
    orderBy: [{ supplier: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, brand: true, size: true, unit: true, supplier: true, moq: true, currentQty: true, lowStockAt: true, costPence: true },
  });

  // Anything at/below its threshold needs reordering; suggest a qty rounded up to MOQ.
  const toReorder = items
    .filter((i) => i.lowStockAt > 0 && i.currentQty <= i.lowStockAt)
    .map((i) => {
      const target = Math.max(i.lowStockAt, i.moq);
      const shortfall = Math.max(i.moq, Math.ceil(target - i.currentQty));
      const suggestQty = Math.max(i.moq, Math.ceil(shortfall / i.moq) * i.moq);
      return {
        id: i.id, name: i.name, brand: i.brand, size: i.size, unit: i.unit,
        supplier: i.supplier || 'Unassigned supplier', moq: i.moq,
        currentQty: i.currentQty, suggestQty, costPence: i.costPence,
        lineCostPence: i.costPence != null ? i.costPence * suggestQty : null,
      };
    });

  // Group by supplier.
  const groupsMap = new Map<string, typeof toReorder>();
  for (const r of toReorder) {
    if (!groupsMap.has(r.supplier)) groupsMap.set(r.supplier, []);
    groupsMap.get(r.supplier)!.push(r);
  }
  const groups = [...groupsMap.entries()].map(([supplier, lines]) => ({
    supplier,
    lines,
    totalPence: lines.reduce((s, l) => s + (l.lineCostPence ?? 0), 0),
  }));
  const grandTotal = groups.reduce((s, g) => s + g.totalPence, 0);

  const can = await sessionPermissions();
  const locale = await getLocale();
  const uk = locale === 'uk';
  const L = (en: string, ukt: string) => (uk ? ukt : en);

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">{L('Reorder', 'Замовлення запасів')}</h1>
          <p className="mt-1 text-sm text-[var(--color-stone)]">
            {L('Everything at or below its low-stock level, grouped by supplier, with quantities rounded up to the minimum order quantity.', 'Усі позиції на рівні або нижче порогу, згруповані за постачальником, з кількістю, округленою до мінімального замовлення.')}
          </p>
        </div>
        <Link href="/admin/inventory" className="text-sm text-[var(--color-gold)] hover:underline">{L('Inventory', 'Склад')} →</Link>
      </div>

      {toReorder.length === 0 ? (
        <p className="mt-8 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 text-sm text-[var(--color-stone)]">
          {L('Nothing needs reordering — all stock is above its threshold. 🎉', 'Нічого замовляти — усі запаси вище порогу. 🎉')}
        </p>
      ) : (
        <>
          <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
            <span className="text-sm text-[var(--color-stone)]">{L('Estimated order value', 'Орієнтовна вартість замовлення')}: </span>
            <span className="font-[family-name:var(--font-display)] text-xl">{gbp(grandTotal)}</span>
            <span className="ml-2 text-xs text-[var(--color-stone)]">({L('at wholesale cost, ex VAT', 'за оптовою ціною, без ПДВ')})</span>
          </div>
          <div className="mt-8">
            <ReorderList groups={groups} canManage={canManage} uk={uk} />
          </div>
        </>
      )}
    </AdminShell>
  );
}
