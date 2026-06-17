import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { CourseExperience } from '@/components/academy/CourseExperience';
import { pageMeta } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMeta({ title: 'Course — K Academy', description: 'Your K Academy course.', path: '/academy/learn' });
export const dynamic = 'force-dynamic';

export default async function LearnPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!crmEnabled) redirect('/academy');
  const { slug } = await params;

  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) redirect('/academy/portal');

  const { getCourseLearning } = await import('@/lib/lms');
  const { studentStanding } = await import('@/lib/academy-gamification');
  const { registerForAge } = await import('@/components/academy/lessonFlow');
  const [learning, standing] = await Promise.all([getCourseLearning(slug, student.id), studentStanding(student.id)]);
  const age = student.dob ? Math.floor((Date.now() - new Date(student.dob).getTime()) / 31557600000) : null;
  const register = registerForAge(age);

  if (!learning) {
    return (
      <section className="container-lux py-[calc(var(--header-h,5.25rem)+4rem)]">
        <div className="mx-auto max-w-lg rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 text-center">
          <h1 className="font-[family-name:var(--font-display)] text-2xl">Not available yet</h1>
          <p className="mt-3 text-[var(--color-stone)]">You don’t have access to this course yet. Once your place is confirmed, it’ll appear in your portal.</p>
          <Link href="/academy/portal" className="mt-5 inline-block link-underline font-medium text-[var(--color-ink)]">Back to your portal →</Link>
        </div>
      </section>
    );
  }

  // BLD-445: the mandatory pre-course information must be acknowledged first.
  if (learning.course.preCourseInfo && !learning.preCourseAck) {
    const { PreCourseGate } = await import('@/components/academy/PreCourseGate');
    return (
      <section className="container-lux py-[calc(var(--header-h,5.25rem)+2rem)]">
        <PreCourseGate slug={slug} title={learning.course.title} level={learning.course.level} content={learning.course.preCourseInfo} />
      </section>
    );
  }

  return (
    <section className="container-lux py-[calc(var(--header-h,5.25rem)+2rem)]">
      <CourseExperience learning={learning} slug={slug} xp={standing.xp} register={register} />
    </section>
  );
}
