import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { AcademyManager } from '@/components/admin/AcademyManager';
import { LiveClassManager } from '@/components/admin/LiveClassManager';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function AdminAcademyPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');

  const { db } = await import('@/lib/db');
  const [courses, enrolments, liveClasses] = await Promise.all([
    db.course.findMany({ orderBy: [{ order: 'asc' }], include: { cohorts: { orderBy: { startAt: 'asc' } } } }),
    db.enrolment.findMany({ orderBy: { createdAt: 'desc' }, take: 200, include: { course: { select: { title: true } }, cohort: { select: { startAt: true } } } }),
    db.liveClass.findMany({ orderBy: { startAt: 'asc' }, include: { course: { select: { title: true } } } }),
  ]);
  const liveView = liveClasses.map((l) => ({ id: l.id, courseId: l.courseId, courseTitle: l.course.title, title: l.title, startAt: l.startAt.toISOString(), endAt: l.endAt?.toISOString() ?? null, joinUrl: l.joinUrl, trainer: l.trainer, description: l.description }));

  const coursesView = courses.map((c) => ({
    id: c.id, slug: c.slug, title: c.title, level: c.level, summary: c.summary, description: c.description,
    pricePence: c.pricePence, depositPence: c.depositPence, durationText: c.durationText, format: c.format,
    accreditations: c.accreditations, outcomes: c.outcomes, prerequisites: c.prerequisites, thinkificUrl: c.thinkificUrl,
    featured: c.featured, active: c.active,
    cohorts: c.cohorts.map((h) => ({ id: h.id, startAt: h.startAt.toISOString(), endAt: h.endAt?.toISOString() ?? null, capacity: h.capacity, location: h.location, trainer: h.trainer, status: h.status })),
  }));
  const enrolmentsView = enrolments.map((e) => ({
    id: e.id, courseId: e.courseId, courseTitle: e.course.title, cohortId: e.cohortId,
    applicantName: e.applicantName, applicantEmail: e.applicantEmail, applicantPhone: e.applicantPhone,
    experience: e.experience, financeInterest: e.financeInterest, status: e.status,
    pricePence: e.pricePence, paidPence: e.paidPence, notes: e.notes, createdAt: e.createdAt.toISOString(),
  }));

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">K Academy</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">Manage training courses, cohort dates and trainee applications. Theory, video and tests run natively in the trainee portal; practical days and live online classes are scheduled here.</p>
      <div className="mt-8">
        <AcademyManager courses={coursesView} enrolments={enrolmentsView} />
      </div>
      <div className="mt-12">
        <h2 className="font-[family-name:var(--font-display)] text-2xl">Live online classes</h2>
        <p className="mt-1 text-sm text-[var(--color-stone)]">Schedule Google Meet sessions — they appear in each enrolled trainee’s calendar with a Join button.</p>
        <div className="mt-5">
          <LiveClassManager courses={coursesView.map((c) => ({ id: c.id, title: c.title }))} liveClasses={liveView} />
        </div>
      </div>
    </AdminShell>
  );
}
