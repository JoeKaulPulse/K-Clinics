import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { CohortsBoard, type CourseLite, type EnrolLite, type ReleaseLite, type PracticalDayLite } from '@/components/admin/CohortsBoard';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

// BLD-528: dedicated Cohorts page — create cohorts and control each cohort's
// lesson-access window across all courses in one place.
export default async function AdminAcademyCohortsPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');

  const { db } = await import('@/lib/db');
  const [courses, enrolments] = await Promise.all([
    db.course.findMany({ orderBy: [{ order: 'asc' }], include: { cohorts: { orderBy: { startAt: 'asc' } }, modules: { orderBy: { order: 'asc' }, select: { id: true, title: true } } } }),
    db.enrolment.findMany({ where: { cohortId: { not: null } }, select: { id: true, courseId: true, cohortId: true, applicantName: true, applicantEmail: true, status: true } }),
  ]);
  // BLD: per-cohort module release schedule (drip).
  const cohortIds = courses.flatMap((c) => c.cohorts.map((h) => h.id));
  const [releaseRows, dayRows] = await Promise.all([
    cohortIds.length ? db.cohortModuleRelease.findMany({ where: { cohortId: { in: cohortIds } }, select: { cohortId: true, moduleId: true, releaseAt: true } }) : Promise.resolve([]),
    // BLD-881: each cohort's own practical training days.
    cohortIds.length ? db.cohortPracticalDay.findMany({ where: { cohortId: { in: cohortIds } }, orderBy: { startAt: 'asc' } }) : Promise.resolve([]),
  ]);

  const coursesView: CourseLite[] = courses.map((c) => ({
    id: c.id, title: c.title,
    modules: c.modules.map((m) => ({ id: m.id, title: m.title })),
    cohorts: c.cohorts.map((h) => ({ id: h.id, name: h.name ?? null, startAt: h.startAt.toISOString(), endAt: h.endAt?.toISOString() ?? null, accessStartAt: h.accessStartAt?.toISOString() ?? null, accessEndAt: h.accessEndAt?.toISOString() ?? null, capacity: h.capacity, location: h.location, trainer: h.trainer, status: h.status })),
  }));
  const enrolmentsView: EnrolLite[] = enrolments.map((e) => ({ id: e.id, courseId: e.courseId, cohortId: e.cohortId, name: e.applicantName, email: e.applicantEmail, status: e.status }));
  const releasesView: ReleaseLite[] = releaseRows.map((r) => ({ cohortId: r.cohortId, moduleId: r.moduleId, releaseAt: r.releaseAt.toISOString() }));
  const daysView: PracticalDayLite[] = dayRows.map((d) => ({ id: d.id, cohortId: d.cohortId, title: d.title, startAt: d.startAt.toISOString(), endAt: d.endAt?.toISOString() ?? null, location: d.location, trainer: d.trainer }));

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <Link href="/admin/academy" className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">← K Academy</Link>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">Cohorts</h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">Create start groups for each course and control content release. The access window sets when the whole course opens/closes; the per-cohort <strong>release schedule</strong> lets you lock individual modules and unlock them on set dates as materials are ready.</p>
      <div className="mt-8">
        <CohortsBoard courses={coursesView} enrolments={enrolmentsView} releases={releasesView} practicalDays={daysView} />
      </div>
    </AdminShell>
  );
}
