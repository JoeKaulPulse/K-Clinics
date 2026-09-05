import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { FinancePlanner } from '@/components/admin/FinancePlanner';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

// Finance planner: net/gross profit + EBITDA forecast and the treatment pricing
// architecture. Behind the same PIN/passkey step-up as cashflow.
export default async function FinancePlannerPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'finance.view')) redirect('/admin');
  const { financeUnlocked } = await import('@/lib/finance-lock');
  if (!(await financeUnlocked(session!.sub))) redirect('/admin/finance/unlock?next=/admin/finance/planner');
  const canManage = sessionCan(session, 'finance.manage');

  const { loadPlannerInputs, loadCatalogue, buildPlan } = await import('@/lib/finance-planner');
  const [inputs, catalogue] = await Promise.all([loadPlannerInputs(), loadCatalogue()]);
  const plan = buildPlan(inputs, catalogue);

  const can = await sessionPermissions();
  const locale = await getLocale();
  const uk = locale === 'uk';

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">{uk ? 'Фінансовий план' : 'Finance planner'}</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">
        {uk
          ? 'Прогноз валового прибутку, EBITDA і чистого прибутку, вартість обладнання й енергії, та архітектура цін за процедурами — на основі живого каталогу.'
          : 'Gross profit, EBITDA and net profit forecast, machinery and energy costs, and the per-treatment pricing architecture — driven by the live catalogue.'}
      </p>
      <div className="mt-8">
        <FinancePlanner inputs={inputs} plan={plan} canManage={canManage} uk={uk} />
      </div>
    </AdminShell>
  );
}
