import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { AcademyPortalShell } from '@/components/academy/AcademyPortalShell';
import { PageTitle } from '@/components/academy/ui';
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

  const { listMyEntries, myCourses, TREATMENT_SUGGESTIONS, STATUS_LABEL } = await import('@/lib/portfolio');
  const [entries, courses] = await Promise.all([listMyEntries(student.id), myCourses(student.id)]);

  return (
    <AcademyPortalShell firstName={student.firstName}>
      <PageTitle lede="Log the practical cases you complete and submit them for your tutor to review. Record the treatment, an anonymous client reference, before/after photos and your method — always keep client details anonymous.">Portfolio</PageTitle>
      <PortfolioManager entries={entries} courses={courses} treatmentSuggestions={TREATMENT_SUGGESTIONS} statusLabels={STATUS_LABEL} />
    </AcademyPortalShell>
  );
}
