import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { AcademyPortalShell } from '@/components/academy/AcademyPortalShell';
import { PageTitle, Card, ProgressBar, Pill } from '@/components/academy/ui';
import { PortfolioManager } from '@/components/academy/PortfolioManager';
import { pageMeta } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMeta({ title: 'Portfolio — K Academy', description: 'Build your practical case-study portfolio and have it reviewed by your tutors.', path: '/academy/portfolio', noindex: true });
export const dynamic = 'force-dynamic';

// BLD-534: learner portfolio.
export default async function PortfolioPage() {
  if (!crmEnabled) redirect('/academy');
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) redirect('/academy/portal');

  const { listMyEntries, myCourses, portfolioProgress, TREATMENT_SUGGESTIONS, STATUS_LABEL } = await import('@/lib/portfolio');
  const [entries, courses, progress] = await Promise.all([listMyEntries(student.id), myCourses(student.id), portfolioProgress(student.id)]);

  return (
    <AcademyPortalShell firstName={student.firstName}>
      <PageTitle lede="Log the practical cases you complete and submit them for your tutor to review. Record the treatment, an anonymous client reference, before/after photos and your method — always keep client details anonymous.">Portfolio</PageTitle>

      {progress.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          {progress.map((p) => {
            const done = Math.min(p.approved, p.target);
            const pct = Math.round((done / p.target) * 100);
            return (
              <Card key={p.courseId} tone="bone">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-[var(--color-ink)]">{p.courseTitle}</span>
                  {p.approved >= p.target ? <Pill tone="good">Complete</Pill> : <Pill tone="neutral">{p.approved}/{p.target} approved</Pill>}
                </div>
                <div className="mt-2"><ProgressBar pct={pct} /></div>
                <p className="mt-1.5 text-xs text-[var(--color-stone)]">{p.approved >= p.target ? 'Portfolio requirement met for this course.' : `${p.target - p.approved} more approved case${p.target - p.approved === 1 ? '' : 's'} to go${p.submitted > 0 ? ` · ${p.submitted} awaiting review` : ''}.`}</p>
              </Card>
            );
          })}
        </div>
      )}

      <PortfolioManager entries={entries} courses={courses} treatmentSuggestions={TREATMENT_SUGGESTIONS} statusLabels={STATUS_LABEL} />
    </AcademyPortalShell>
  );
}
