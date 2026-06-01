import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { CareersManager } from '@/components/admin/CareersManager';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function AdminCareersPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');

  const { db } = await import('@/lib/db');
  const [vacancies, applications] = await Promise.all([
    db.vacancy.findMany({ orderBy: [{ order: 'asc' }] }),
    db.jobApplication.findMany({ orderBy: { createdAt: 'desc' }, take: 200, include: { vacancy: { select: { title: true } } } }),
  ]);

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Careers</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">Publish vacancies to the website and manage applications. Active roles appear live on /careers.</p>
      <div className="mt-8">
        <CareersManager
          vacancies={vacancies.map((v) => ({ id: v.id, title: v.title, department: v.department, location: v.location, type: v.type, summary: v.summary, description: v.description, active: v.active }))}
          applications={applications.map((a) => ({ id: a.id, roleTitle: a.vacancy?.title || a.roleTitle, name: a.name, email: a.email, phone: a.phone, coverNote: a.coverNote, cvUrl: a.cvUrl, status: a.status, createdAt: a.createdAt.toISOString() }))}
        />
      </div>
    </AdminShell>
  );
}
