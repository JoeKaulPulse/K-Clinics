import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { PricingPlanner, type CatalogueRow, type SavedScenario, type StockOption } from '@/components/admin/PricingPlanner';
import { getConfigNumber } from '@/lib/settings';
import { getLocale } from '@/lib/locale';
import { EMPTY_INPUTS, type PlannerInputs } from '@/lib/pricing-planner';

export const dynamic = 'force-dynamic';

// Finance → Pricing planner (BLD-1758). Works a retail price out from what a
// treatment or product costs to deliver, and shows what the prices already in
// the catalogue are earning.
export default async function PricingPlannerPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'finance.view')) redirect('/admin');

  const { db } = await import('@/lib/db');
  const { getVatConfig, effectiveVatClass } = await import('@/lib/vat');

  const [vat, minMarginPct, services, products, stockItems, scenarioRows, can, locale] = await Promise.all([
    getVatConfig(),
    getConfigNumber('min_margin_pct').catch(() => 0),
    db.service.findMany({
      where: { active: true },
      select: { name: true, category: true, vatClass: true, variants: { where: { active: true }, select: { id: true, name: true, pricePence: true, costPence: true } } },
      orderBy: { name: 'asc' },
    }).catch(() => []),
    db.product.findMany({
      where: { status: { not: 'ARCHIVED' } },
      select: { id: true, name: true, brand: true, vatClass: true, pricePence: true, costPence: true },
      orderBy: { name: 'asc' },
      take: 500,
    }).catch(() => []),
    db.stockItem.findMany({
      where: { active: true, costPence: { gt: 0 } },
      select: { id: true, name: true, brand: true, size: true, unit: true, costPence: true },
      orderBy: { name: 'asc' },
      take: 300,
    }).catch(() => []),
    db.pricingScenario.findMany({ orderBy: { updatedAt: 'desc' }, take: 100 }).catch(() => []),
    sessionPermissions(),
    getLocale(),
  ]);

  const catalogue: CatalogueRow[] = [
    ...services.flatMap((s) => s.variants.map((v) => ({
      id: v.id,
      kind: 'variant' as const,
      name: s.name,
      sub: v.name,
      pricePence: v.pricePence,
      costPence: v.costPence,
      vatClass: effectiveVatClass({ vatClass: s.vatClass, category: s.category }),
    }))),
    ...products.map((p) => ({
      id: p.id,
      kind: 'product' as const,
      name: p.name,
      // Product.category is a free-text shop category, so it can't feed the
      // dentistry→EXEMPT fallback the way a service category does: an explicit
      // class or standard-rated, matching how Reports treats retail VAT.
      sub: [p.brand, 'Retail product'].filter(Boolean).join(' · '),
      pricePence: p.pricePence,
      costPence: p.costPence,
      vatClass: effectiveVatClass({ vatClass: p.vatClass }),
    })),
  ];

  const stock: StockOption[] = stockItems.map((i) => ({
    id: i.id,
    label: [i.brand, i.name, i.size].filter(Boolean).join(' '),
    unit: i.unit,
    costPence: i.costPence ?? 0,
  }));

  const scenarios: SavedScenario[] = scenarioRows.map((s) => ({
    id: s.id,
    name: s.name,
    notes: s.notes,
    pricePence: s.pricePence,
    costPence: s.costPence,
    marginPct: s.marginPct,
    linkedType: s.linkedType,
    linkedId: s.linkedId,
    // Saved input shapes predate nothing yet, but a scenario stored before a
    // future field is added would arrive missing it — merge over the defaults
    // so the planner always gets a complete set.
    inputs: { ...EMPTY_INPUTS, ...(s.inputs as unknown as Partial<PlannerInputs>) } as PlannerInputs,
    updatedAt: s.updatedAt.toISOString(),
  }));

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Pricing planner</h1>
      <p className="mt-1 max-w-3xl text-sm text-[var(--color-stone)]">
        Work a retail price out from what something costs you to deliver, or test a price you have in mind and see what is left after VAT,
        card fees and the goods themselves. Save the working so a price can be explained — and redone when supplier costs move.
      </p>
      <div className="mt-8">
        <PricingPlanner
          vat={{ registered: vat.registered, defaultRatePct: vat.defaultRatePct }}
          minMarginPct={minMarginPct}
          catalogue={catalogue}
          stock={stock}
          scenarios={scenarios}
          canSave={sessionCan(session, 'finance.manage')}
          canApply={sessionCan(session, 'settings.manage')}
        />
      </div>
    </AdminShell>
  );
}
