import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { Courses } from '@/components/admin/AcademyManager';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function AdminAcademyPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');

  const { db } = await import('@/lib/db');
  const now = new Date();
  const [courses, newApplications, totalEnrolments, students, upcomingLive, openVacancies, newFunding] = await Promise.all([
    db.course.findMany({ orderBy: [{ order: 'asc' }], include: { cohorts: { orderBy: { startAt: 'asc' } } } }),
    db.enrolment.count({ where: { status: 'APPLIED' } }),
    db.enrolment.count(),
    db.academyStudent.count(),
    db.liveClass.count({ where: { startAt: { gte: now } } }),
    db.vacancy.count({ where: { active: true } }),
    db.fundingApplication.count({ where: { status: 'NEW' } }),
  ]);

  const coursesView = courses.map((c) => ({
    id: c.id, slug: c.slug, title: c.title, level: c.level, summary: c.summary, description: c.description,
    pricePence: c.pricePence, depositPence: c.depositPence, durationText: c.durationText, format: c.format,
    accreditations: c.accreditations, outcomes: c.outcomes, prerequisites: c.prerequisites, thinkificUrl: c.thinkificUrl,
    featured: c.featured, active: c.active,
    cohorts: c.cohorts.map((h) => ({ id: h.id, startAt: h.startAt.toISOString(), endAt: h.endAt?.toISOString() ?? null, accessStartAt: h.accessStartAt?.toISOString() ?? null, accessEndAt: h.accessEndAt?.toISOString() ?? null, capacity: h.capacity, location: h.location, trainer: h.trainer, status: h.status })),
  }));

  const cards: { href: string; label: string; value: string; sub: string }[] = [
    { href: '/admin/academy/enrolments', label: 'Applications', value: String(newApplications), sub: `new · ${totalEnrolments} total` },
    { href: '/admin/academy/funding', label: 'Funding', value: String(newFunding), sub: 'new enquiries' },
    { href: '/admin/academy/students', label: 'Trainees', value: String(students), sub: 'portal accounts' },
    { href: '/admin/academy/live-classes', label: 'Live classes', value: String(upcomingLive), sub: 'upcoming' },
    { href: '/admin/careers', label: 'Careers', value: String(openVacancies), sub: 'open roles' },
  ];

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">K Academy</h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">The training arm. Build courses and curriculum here; manage applicants, trainee accounts and live classes from the sections below. Theory, video and tests run in the trainee portal; practical days and live online classes are scheduled here.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="group rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4 transition-colors hover:border-[var(--color-gold)]">
            <span className="text-xs uppercase tracking-wide text-[var(--color-stone)]">{c.label}</span>
            <span className="mt-1 block font-[family-name:var(--font-display)] text-3xl text-[var(--color-ink)]">{c.value}</span>
            <span className="text-xs text-[var(--color-stone)]">{c.sub}</span>
            <span className="mt-2 block text-xs text-[var(--color-gold)] opacity-0 transition-opacity group-hover:opacity-100">Open →</span>
          </Link>
        ))}
      </div>

      <div className="mt-10">
        <Courses courses={coursesView} />
      </div>
    </AdminShell>
  );
}
