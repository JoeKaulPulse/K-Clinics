import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { AcademyPortalShell } from '@/components/academy/AcademyPortalShell';
import { DemoPlayer } from '@/components/academy/DemoPlayer';
import { pageMeta } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMeta({ title: 'Spot the mistake — K Academy', description: 'Watch a walkthrough and spot what’s done wrong.', path: '/academy/demos', noindex: true });
export const dynamic = 'force-dynamic';

// BLD-539: spot-the-mistake demo player.
export default async function DemoPage({ params }: { params: Promise<{ id: string }> }) {
  if (!crmEnabled) redirect('/academy');
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) redirect('/academy/portal');
  const { id } = await params;

  const { getDemoPlay } = await import('@/lib/demos');
  const demo = await getDemoPlay(id, student.id);
  if (!demo) notFound();

  return (
    <AcademyPortalShell firstName={student.firstName}>
      <Link href="/academy/exercises" className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">← Exercises</Link>
      <div className="mt-3">
        <DemoPlayer demo={demo} />
      </div>
    </AcademyPortalShell>
  );
}
