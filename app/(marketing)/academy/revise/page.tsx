import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { AcademyPortalShell } from '@/components/academy/AcademyPortalShell';
import { ReviseBoard } from '@/components/academy/ReviseBoard';
import { PageTitle } from '@/components/academy/ui';
import { pageMeta } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMeta({ title: 'Revise — K Academy', description: 'Flashcards with spaced repetition — revise the things you find hard.', path: '/academy/revise', noindex: true });
export const dynamic = 'force-dynamic';

export default async function RevisePage() {
  if (!crmEnabled) redirect('/academy');
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) redirect('/academy/portal');

  const { listDecks } = await import('@/lib/flashcards');
  const decks = await listDecks(student.id);

  return (
    <AcademyPortalShell firstName={student.firstName}>
      <PageTitle lede="Flashcards with spaced repetition. Rate how well you knew each card and we’ll resurface the hard ones more often — the proven way to make things stick.">Revise</PageTitle>
      <ReviseBoard decks={decks} />
    </AcademyPortalShell>
  );
}
