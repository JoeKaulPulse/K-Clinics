import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { CoursePlayer } from '@/components/academy/CoursePlayer';
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
  const learning = await getCourseLearning(slug, student.id);

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

  return (
    <section className="container-lux py-[calc(var(--header-h,5.25rem)+2rem)]">
      <CoursePlayer learning={learning} slug={slug} />
    </section>
  );
}
