import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { CourseExperience } from '@/components/academy/CourseExperience';
import { AcademyPortalShell } from '@/components/academy/AcademyPortalShell';
import { pageMeta } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMeta({ title: 'Course — K Academy', description: 'Your K Academy course.', path: '/academy/learn', noindex: true }); // BLD-341: per-learner page — never index
export const dynamic = 'force-dynamic';

export default async function LearnPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!crmEnabled) redirect('/academy');
  const { slug } = await params;

  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) redirect('/academy/portal');

  const { getCourseLearning, getMyReview } = await import('@/lib/lms');
  const { studentStanding } = await import('@/lib/academy-gamification');
  const { registerForAge } = await import('@/components/academy/lessonFlow');
  const [learning, standing] = await Promise.all([getCourseLearning(slug, student.id), studentStanding(student.id)]);
  const myReview = learning ? await getMyReview(student.id, learning.course.id) : null;
  const age = student.dob ? Math.floor((Date.now() - new Date(student.dob).getTime()) / 31557600000) : null;
  const register = registerForAge(age);

  if (!learning) {
    return (
      <AcademyPortalShell firstName={student.firstName}>
        <div className="mx-auto max-w-lg rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 text-center">
          <h1 className="font-[family-name:var(--font-display)] text-2xl">Not available yet</h1>
          <p className="mt-3 text-[var(--color-stone)]">You don’t have access to this course yet. Once your place is confirmed, it’ll appear in your portal.</p>
          <Link href="/academy/portal" className="mt-5 inline-block link-underline font-medium text-[var(--color-ink)]">Back to your portal →</Link>
        </div>
      </AcademyPortalShell>
    );
  }

  // BLD-445: the mandatory pre-course information must be acknowledged first.
  // BLD-730: the gate now also collects the signed Learner Agreement, and shows
  // for every not-yet-acked enrolment (even when a course has no pre-course
  // info page) so no new learner starts without a signed agreement. Learners who
  // already acknowledged are not re-gated.
  if (!learning.preCourseAck) {
    const { PreCourseGate } = await import('@/components/academy/PreCourseGate');
    const { LEARNER_AGREEMENT_SECTIONS, LEARNER_AGREEMENT_VERSION } = await import('@/lib/learner-agreement');
    return (
      <AcademyPortalShell firstName={student.firstName}>
        <PreCourseGate
          slug={slug} title={learning.course.title} level={learning.course.level}
          content={learning.course.preCourseInfo ?? ''}
          agreement={{ sections: LEARNER_AGREEMENT_SECTIONS, version: LEARNER_AGREEMENT_VERSION }}
        />
      </AcademyPortalShell>
    );
  }

  return (
    <AcademyPortalShell firstName={student.firstName}>
      <CourseExperience learning={learning} slug={slug} xp={standing.xp} register={register} myReview={myReview} />
    </AcademyPortalShell>
  );
}
