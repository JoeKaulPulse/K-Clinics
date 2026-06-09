import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { CashflowManager } from '@/components/admin/CashflowManager';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function CashflowPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'finance.view')) redirect('/admin');
  const { financeUnlocked } = await import('@/lib/finance-lock');
  if (!(await financeUnlocked(session!.sub))) redirect('/admin/finance/unlock?next=/admin/cashflow');
  const canManage = sessionCan(session, 'finance.manage');

  const { buildForecast } = await import('@/lib/cashflow');
  const { liveBalances } = await import('@/lib/finance-feeds');
  const { db } = await import('@/lib/db');
  const [forecast, entriesRaw, balances] = await Promise.all([
    buildForecast(),
    db.cashflowEntry.findMany({ where: { active: true }, orderBy: [{ type: 'asc' }, { category: 'asc' }, { label: 'asc' }] }),
    liveBalances(),
  ]);

  const entries = entriesRaw.map((e) => ({
    id: e.id, type: e.type as string, category: e.category, label: e.label, amountPence: e.amountPence,
    cadence: e.cadence as string, startDate: e.startDate?.toISOString().slice(0, 10) || null, endDate: e.endDate?.toISOString().slice(0, 10) || null,
  }));

  const can = await sessionPermissions();
  const locale = await getLocale();
  const uk = locale === 'uk';

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">{uk ? 'Прогноз грошового потоку' : 'Cashflow forecast'}</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">
        {uk
          ? 'Прогнозуйте доходи й витрати, та відкладайте захищені резерви — поповнення, ремонт, бонуси, підвищення зарплат — щоб бізнес завжди мав запас.'
          : 'Project income and expenses, and ring-fence reserves — replenishment, refurbishment, incentives, salary uplifts — so the business always keeps a working slush fund.'}
      </p>
      <div className="mt-8">
        <CashflowManager
          cfg={forecast.cfg}
          drivers={forecast.drivers}
          consumablesMonthly={forecast.consumablesMonthly}
          months={forecast.months}
          reserves={forecast.reserves}
          summary={forecast.summary}
          entries={entries}
          balances={balances}
          canManage={canManage}
          uk={uk}
        />
      </div>
    </AdminShell>
  );
}
