import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { Applications, EnrolStudent } from '@/components/admin/AcademyManager';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function AdminAcademyApplicationsPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');

  const { db } = await import('@/lib/db');
  const [courses, enrolments] = await Promise.all([
    db.course.findMany({ orderBy: [{ order: 'asc' }], include: { cohorts: { orderBy: { startAt: 'asc' } } } }),
    db.enrolment.findMany({ orderBy: { createdAt: 'desc' }, take: 300, include: { course: { select: { title: true } }, cohort: { select: { startAt: true } } } }),
  ]);
  // Itemised payments for the listed enrolments, in one query, grouped per enrolment.
  const paymentRows = await db.enrolmentPayment.findMany({
    where: { enrolmentId: { in: enrolments.map((e) => e.id) } },
    orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
  });
  const paymentsByEnrolment = new Map<string, typeof paymentRows>();
  for (const p of paymentRows) {
    const arr = paymentsByEnrolment.get(p.enrolmentId) ?? [];
    arr.push(p);
    paymentsByEnrolment.set(p.enrolmentId, arr);
  }

  const coursesView = courses.map((c) => ({
    id: c.id, slug: c.slug, title: c.title, level: c.level, summary: c.summary, description: c.description,
    pricePence: c.pricePence, depositPence: c.depositPence,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    promoPrice: (c as any).promoPrice ?? null, promoStartAt: (c as any).promoStartAt?.toISOString() ?? null, promoEndAt: (c as any).promoEndAt?.toISOString() ?? null,
    durationText: c.durationText, format: c.format,
    accreditations: c.accreditations, outcomes: c.outcomes, prerequisites: c.prerequisites, thinkificUrl: c.thinkificUrl,
    featured: c.featured, active: c.active,
    cohorts: c.cohorts.map((h) => ({ id: h.id, startAt: h.startAt.toISOString(), endAt: h.endAt?.toISOString() ?? null, accessStartAt: h.accessStartAt?.toISOString() ?? null, accessEndAt: h.accessEndAt?.toISOString() ?? null, capacity: h.capacity, location: h.location, trainer: h.trainer, name: h.name ?? null, status: h.status })),
  }));
  const enrolmentsView = enrolments.map((e) => ({
    id: e.id, courseId: e.courseId, courseTitle: e.course.title, cohortId: e.cohortId,
    applicantName: e.applicantName, applicantEmail: e.applicantEmail, applicantPhone: e.applicantPhone,
    experience: e.experience, financeInterest: e.financeInterest, status: e.status,
    pricePence: e.pricePence, paidPence: e.paidPence, notes: e.notes, createdAt: e.createdAt.toISOString(),
    studentId: e.studentId, offeredAt: e.offeredAt?.toISOString() ?? null, offerExpiresAt: e.offerExpiresAt?.toISOString() ?? null,
    acceptedAt: e.acceptedAt?.toISOString() ?? null, paymentPlan: e.paymentPlan, preCourseAckAt: e.preCourseAckAt?.toISOString() ?? null,
    payments: (paymentsByEnrolment.get(e.id) ?? []).map((p) => ({
      id: p.id, kind: p.kind, method: p.method, state: p.state, amountPence: p.amountPence,
      dueAt: p.dueAt?.toISOString() ?? null, paidAt: p.paidAt?.toISOString() ?? null, note: p.note, recordedBy: p.recordedBy,
    })),
  }));

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <Link href="/admin/academy" className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">← K Academy</Link>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">Applications &amp; enrolments</h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">Move applicants through the pipeline, assign a cohort, and record payments (taken manually or via Clearpay).</p>
      <div className="mt-8">
        <EnrolStudent courses={coursesView} />
        <Applications courses={coursesView} enrolments={enrolmentsView} />
      </div>
    </AdminShell>
  );
}
