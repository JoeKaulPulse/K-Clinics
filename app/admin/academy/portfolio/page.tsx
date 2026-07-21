import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { PortfolioReview } from '@/components/admin/PortfolioReview';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

// BLD-534: tutor review of trainee portfolios.
export default async function AdminAcademyPortfolioPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');

  const { adminListEntries, STATUS_LABEL } = await import('@/lib/portfolio');
  const entries = await adminListEntries();

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <Link href="/admin/academy" className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">← K Academy</Link>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">Portfolios</h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">Trainees’ practical case studies. Open a submitted case to see the treatment notes and before/after photos, then approve it or request changes with feedback. Submitted cases are listed first.</p>
      <div className="mt-8">
        <PortfolioReview entries={entries} statusLabels={STATUS_LABEL} />
      </div>
    </AdminShell>
  );
}
