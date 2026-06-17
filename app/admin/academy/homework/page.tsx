import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { getLocale } from '@/lib/locale';
import { HomeworkReview } from '@/components/admin/HomeworkReview';

export const dynamic = 'force-dynamic';

// BLD-446: tutor queue of learner homework submissions — view/download files,
// leave feedback, set status. Submitted (awaiting review) first.
export default async function HomeworkPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');
  const can = await sessionPermissions();
  const locale = await getLocale();

  const { db } = await import('@/lib/db');
  const subs = await db.homeworkSubmission.findMany({
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    take: 200,
    select: {
      id: true, files: true, note: true, status: true, feedback: true, reviewedBy: true, createdAt: true,
      student: { select: { firstName: true, lastName: true, email: true } },
      lesson: { select: { title: true, module: { select: { course: { select: { title: true } } } } } },
    },
  });
  const rows = subs.map((s) => ({
    id: s.id, files: s.files, note: s.note, status: s.status, feedback: s.feedback, reviewedBy: s.reviewedBy,
    submittedAt: s.createdAt.toISOString(),
    student: [s.student?.firstName, s.student?.lastName].filter(Boolean).join(' ') || s.student?.email || 'Learner',
    lesson: s.lesson.title, course: s.lesson.module.course.title,
  }));

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Homework submissions</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">Review learners’ submitted work, leave feedback, and set the status. Approved or “needs revision” shows in the learner’s lesson.</p>
      <HomeworkReview rows={rows} />
    </AdminShell>
  );
}
