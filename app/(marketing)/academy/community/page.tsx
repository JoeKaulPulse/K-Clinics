import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { AcademyPortalShell } from '@/components/academy/AcademyPortalShell';
import { PageTitle } from '@/components/academy/ui';
import { ForumBoard } from '@/components/academy/ForumBoard';
import { pageMeta } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMeta({ title: 'Community — K Academy', description: 'The K Academy trainee community — ask questions, share your work and support each other.', path: '/academy/community', noindex: true });
export const dynamic = 'force-dynamic';

// BLD-533: trainee community forum.
export default async function CommunityPage() {
  if (!crmEnabled) redirect('/academy');
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) redirect('/academy/portal');

  const { listThreads, FORUM_CATEGORIES } = await import('@/lib/forum');
  const threads = await listThreads();
  const categories = FORUM_CATEGORIES.map((c) => ({ key: c.key, label: c.label }));

  return (
    <AcademyPortalShell firstName={student.firstName}>
      <PageTitle lede="Ask questions, share your work, and support each other through training. Be kind and keep client details anonymous — this space is for the whole cohort.">Community</PageTitle>
      <ForumBoard threads={threads} categories={categories} />
    </AcademyPortalShell>
  );
}
