import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import Link from 'next/link';
import { AcademyPortalShell } from '@/components/academy/AcademyPortalShell';
import { PageTitle, SectionTitle, Card, Pill } from '@/components/academy/ui';
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

  const courseIds = courses.map((c) => c.id);
  const { listExercises } = await import('@/lib/exercises');
  const { listDemos } = await import('@/lib/demos');
  const groups: ExerciseGroup[] = [];
  for (const c of courses) {
    const exercises = await listExercises(c.id, student.id);
    if (exercises.length > 0) groups.push({ courseId: c.id, courseTitle: c.title, exercises });
  }
  const demos = await listDemos(courseIds, student.id);

  return (
    <AcademyPortalShell firstName={student.firstName}>
      <PageTitle lede="Hands-on practice that makes theory stick — pinpoint structures on an image, match terms, put procedures in order, and spot mistakes in real walkthroughs. Instant feedback, retry as often as you like.">Exercises</PageTitle>

      {demos.length > 0 && (
        <section className="mb-10">
          <SectionTitle sub="Watch a walkthrough and press space the moment you spot something done wrong.">Spot the mistake</SectionTitle>
          <ul className="grid gap-3 sm:grid-cols-2">
            {demos.map((d) => (
              <li key={d.id}>
                <Link href={`/academy/demos/${d.id}`} className="block">
                  <Card tone="white" className="transition-colors hover:border-[var(--color-gold)]">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="font-[family-name:var(--font-display)] text-lg leading-snug">{d.title}</h3>
                        <p className="mt-0.5 text-xs text-[var(--color-stone)]">{d.courseTitle ? `${d.courseTitle} · ` : ''}{d.mistakeCount} to spot</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {d.best != null && <Pill tone={d.best === 100 ? 'good' : 'neutral'}>Best {d.best}%</Pill>}
                        <span className="text-sm text-[var(--color-gold)]">Watch →</span>
                      </div>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {groups.length > 0 && demos.length > 0 && <SectionTitle>Interactive exercises</SectionTitle>}
      <ExercisesBoard groups={groups} />
    </AcademyPortalShell>
  );
}
