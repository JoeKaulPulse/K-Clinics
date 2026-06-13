import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { LiveClassManager } from '@/components/admin/LiveClassManager';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function AdminAcademyLiveClassesPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');

  const { db } = await import('@/lib/db');
  const [courses, liveClasses] = await Promise.all([
    db.course.findMany({ orderBy: [{ order: 'asc' }], select: { id: true, title: true } }),
    db.liveClass.findMany({ orderBy: { startAt: 'asc' }, include: { course: { select: { title: true } } } }),
  ]);
  const liveView = liveClasses.map((l) => ({ id: l.id, courseId: l.courseId, courseTitle: l.course.title, title: l.title, startAt: l.startAt.toISOString(), endAt: l.endAt?.toISOString() ?? null, joinUrl: l.joinUrl, trainer: l.trainer, description: l.description }));

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <Link href="/admin/academy" className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">← K Academy</Link>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">Live online classes</h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">Schedule Google Meet sessions — they appear in each enrolled trainee’s calendar with a Join button.</p>
      <div className="mt-8">
        <LiveClassManager courses={courses.map((c) => ({ id: c.id, title: c.title }))} liveClasses={liveView} />
      </div>
    </AdminShell>
  );
}
