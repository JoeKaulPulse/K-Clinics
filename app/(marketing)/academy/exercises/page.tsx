import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { AcademyPortalShell } from '@/components/academy/AcademyPortalShell';
import { PageTitle } from '@/components/academy/ui';
import { ExercisesBoard, type ExerciseGroup } from '@/components/academy/ExercisesBoard';
import { pageMeta } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMeta({ title: 'Exercises — K Academy', description: 'Interactive practice — image hotspots, matching and ordering exercises.', path: '/academy/exercises', noindex: true });
export const dynamic = 'force-dynamic';

// BLD-535: interactive exercises across the trainee's enrolled courses.
export default async function ExercisesPage() {
  if (!crmEnabled) redirect('/academy');
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) redirect('/academy/portal');

  const { db } = await import('@/lib/db');
  const enrolments = await db.enrolment.findMany({
    where: { studentId: student.id, status: { in: ['PAID', 'ENROLLED', 'COMPLETED'] } },
    select: { course: { select: { id: true, title: true, order: true } } },
  });
  const courses = [...new Map(enrolments.filter((e) => e.course).map((e) => [e.course!.id, e.course!])).values()].sort((a, b) => a.order - b.order);

  const { listExercises } = await import('@/lib/exercises');
  const groups: ExerciseGroup[] = [];
  for (const c of courses) {
    const exercises = await listExercises(c.id, student.id);
    if (exercises.length > 0) groups.push({ courseId: c.id, courseTitle: c.title, exercises });
  }

  return (
    <AcademyPortalShell firstName={student.firstName}>
      <PageTitle lede="Hands-on practice that makes theory stick — pinpoint structures on an image, match terms, and put procedures in the right order. Instant feedback, retry as often as you like.">Exercises</PageTitle>
      <ExercisesBoard groups={groups} />
    </AcademyPortalShell>
  );
}
