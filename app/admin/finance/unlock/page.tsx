import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { FinanceUnlock } from '@/components/admin/FinanceUnlock';
import { hasFinancePin, financeUnlocked } from '@/lib/finance-lock';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

const SAFE = ['/admin/reports', '/admin/cashflow', '/admin'];

export default async function FinanceUnlockPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'finance.view')) redirect('/admin');
  const { next } = await searchParams;
  const dest = next && SAFE.some((s) => next.startsWith(s)) ? next : '/admin/reports';
  // Already unlocked? Skip straight through.
  if (await financeUnlocked(session!.sub)) redirect(dest);

  const [hasPin, can, locale] = await Promise.all([hasFinancePin(session!.sub), sessionPermissions(), getLocale()]);
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <div className="py-10"><FinanceUnlock hasPin={hasPin} next={dest} /></div>
    </AdminShell>
  );
}
