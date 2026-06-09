import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { FinancialControls } from '@/components/admin/FinancialControls';
import { getConfigNumber } from '@/lib/settings';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function FinancialControlsPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'finance.manage')) redirect('/admin');

  const { getVatConfig } = await import('@/lib/vat');
  const [refundWindowDays, vat, can, locale] = await Promise.all([getConfigNumber('refund_window_days'), getVatConfig(), sessionPermissions(), getLocale()]);
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Financial controls</h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">Policy and guardrails for money — refunds and VAT today, with profit rules and per-service profitability to follow.</p>
      <div className="mt-8"><FinancialControls refundWindowDays={refundWindowDays} vat={vat} /></div>
    </AdminShell>
  );
}
