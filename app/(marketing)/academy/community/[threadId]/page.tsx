import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { AcademyPortalShell } from '@/components/academy/AcademyPortalShell';
import { ForumThreadView } from '@/components/academy/ForumThreadView';
import { pageMeta } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMeta({ title: 'Community — K Academy', description: 'A K Academy community discussion.', path: '/academy/community', noindex: true });
export const dynamic = 'force-dynamic';

// BLD-533: a single community thread.
export default async function CommunityThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  if (!crmEnabled) redirect('/academy');
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) redirect('/academy/portal');
  const { threadId } = await params;

  const { getThread, categoryLabel } = await import('@/lib/forum');
  const thread = await getThread(threadId, student.id);
  if (!thread) notFound();

  return (
    <AcademyPortalShell firstName={student.firstName}>
      <Link href="/academy/community" className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">← Community</Link>
      <div className="mt-3">
        <ForumThreadView thread={{ ...thread, categoryLabel: categoryLabel(thread.category) }} />
      </div>
    </AcademyPortalShell>
  );
}
