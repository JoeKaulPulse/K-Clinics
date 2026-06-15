import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { PracticeRunner } from '@/components/academy/PracticeRunner';
import { pageMeta } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMeta({ title: 'Practice — K Academy', description: 'Test your knowledge any time and see real exam-style papers.', path: '/academy/practice' });
export const dynamic = 'force-dynamic';

export default async function PracticePage() {
  if (!crmEnabled) redirect('/academy');
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) redirect('/academy/portal');

  const { studentPracticeCourses } = await import('@/lib/exam-bank');
  const { listPastPapers } = await import('@/lib/exam-bank');
  const [courses, papers] = await Promise.all([studentPracticeCourses(student.id), listPastPapers()]);

  return (
    <section className="container-lux py-[calc(var(--header-h,5.25rem)+2rem)]">
      <Link href="/academy/portal" className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">← Trainee portal</Link>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl sm:text-4xl">Practice &amp; past papers</h1>
      <p className="mt-2 max-w-2xl text-[var(--color-stone)]">Test yourself any time with exam-style questions, and see what the real papers look like so there are no surprises on the day.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px] lg:items-start">
        <PracticeRunner courses={courses} />

        <aside>
          <h2 className="font-[family-name:var(--font-display)] text-xl">Exam papers &amp; specimens</h2>
          <p className="mt-1 text-sm text-[var(--color-stone)]">Historic and specimen papers to practise with.</p>
          <div className="mt-4 space-y-3">
            {papers.length === 0 ? (
              <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] p-5 text-sm text-[var(--color-stone-soft)]">Specimen papers will be added here as your course approaches its exam.</p>
            ) : papers.map((p) => (
              <div key={p.id} className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{p.title}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-stone-soft)]">{[p.examBoard, p.year, p.courseTitle].filter(Boolean).join(' · ')}</p>
                  </div>
                  {p.fileUrl && <a href={p.fileUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]">Open ↗</a>}
                </div>
                {p.description && <p className="mt-2 text-sm text-[var(--color-ink-soft)]">{p.description}</p>}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
