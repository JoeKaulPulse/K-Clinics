import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { PracticeRunner } from '@/components/academy/PracticeRunner';
import { AcademyPortalShell } from '@/components/academy/AcademyPortalShell';
import { PageTitle, SectionTitle, Card, AButton } from '@/components/academy/ui';
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
    <AcademyPortalShell firstName={student.firstName}>
      <PageTitle lede="Test yourself any time with exam-style questions, and see what the real papers look like so there are no surprises on the day.">Practice &amp; past papers</PageTitle>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-start">
        <PracticeRunner courses={courses} />

        <aside>
          <SectionTitle sub="Historic and specimen papers to practise with.">Exam papers &amp; specimens</SectionTitle>
          <div className="space-y-3">
            {papers.length === 0 ? (
              <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] p-5 text-sm text-[var(--color-stone)]">Specimen papers will be added here as your course approaches its exam.</p>
            ) : papers.map((p) => (
              <Card key={p.id} tone="porcelain" className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{p.title}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-stone)]">{[p.examBoard, p.year, p.courseTitle].filter(Boolean).join(' · ')}</p>
                  </div>
                  {p.fileUrl && <AButton href={p.fileUrl} external variant="secondary" size="sm" className="shrink-0">Open ↗</AButton>}
                </div>
                {p.description && <p className="mt-2 text-sm text-[var(--color-ink-soft)]">{p.description}</p>}
              </Card>
            ))}
          </div>
        </aside>
      </div>
    </AcademyPortalShell>
  );
}
