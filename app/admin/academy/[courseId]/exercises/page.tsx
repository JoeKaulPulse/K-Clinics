import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { ExercisesManager } from '@/components/admin/ExercisesManager';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

// BLD-535: staff author interactive exercises for a course.
export default async function CourseExercisesPage({ params }: { params: Promise<{ courseId: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');
  const { courseId } = await params;

  const { db } = await import('@/lib/db');
  const course = await db.course.findUnique({ where: { id: courseId }, select: { title: true } });
  if (!course) notFound();
  const { adminListExercises } = await import('@/lib/exercises');
  const exercises = await adminListExercises(courseId);

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <Link href={`/admin/academy/${courseId}`} className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">← Curriculum</Link>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">Exercises — {course.title}</h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">Interactive self-check activities for this course. Trainees practise them in the portal’s <strong>Exercises</strong> tab with instant feedback. Hotspots are graded by where the trainee clicks; matching and ordering by their answers — the answer key never reaches the browser.</p>
      <div className="mt-8">
        <ExercisesManager courseId={courseId} exercises={exercises} />
      </div>
    </AdminShell>
  );
}
