import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { FundingApplications, type FundingView } from '@/components/admin/FundingApplications';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function AdminAcademyFundingPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');

  const { db } = await import('@/lib/db');
  const apps = await db.fundingApplication.findMany({
    orderBy: { createdAt: 'desc' },
    take: 300,
    include: { course: { select: { title: true } } },
  });

  const view: FundingView[] = apps.map((a) => ({
    id: a.id,
    name: a.name,
    email: a.email,
    phone: a.phone,
    route: a.route,
    courseLevel: a.courseLevel,
    eligibleRoutes: a.eligibleRoutes,
    status: a.status,
    notes: a.notes,
    message: a.message,
    age19Plus: a.age19Plus,
    residencyOk: a.residencyOk,
    londonResident: a.londonResident,
    islingtonResident: a.islingtonResident,
    employmentStatus: a.employmentStatus,
    lowIncome: a.lowIncome,
    priorLevel3: a.priorLevel3,
    courseTitle: a.course?.title ?? null,
    createdAt: a.createdAt.toISOString(),
  }));

  const open = view.filter((v) => v.status === 'NEW').length;
  const can = await sessionPermissions();
  const locale = await getLocale();

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <Link href="/admin/academy" className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">← K Academy</Link>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">Funding enquiries</h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">
        Students asking for help to pay — from the public <span className="font-medium text-[var(--color-ink)]">/academy/funding</span> page.
        {open > 0 ? <> <span className="font-medium text-[var(--color-ink)]">{open} new</span> awaiting review.</> : null} Work each one through the pipeline and add notes for the team.
      </p>
      <div className="mt-8">
        <FundingApplications applications={view} />
      </div>
    </AdminShell>
  );
}
