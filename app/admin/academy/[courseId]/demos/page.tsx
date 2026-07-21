import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { DemosManager } from '@/components/admin/DemosManager';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

// BLD-539: staff author "spot the mistake" demo videos for a course.
export default async function CourseDemosPage({ params }: { params: Promise<{ courseId: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');
  const { courseId } = await params;

  const { db } = await import('@/lib/db');
  const course = await db.course.findUnique({ where: { id: courseId }, select: { title: true } });
  if (!course) notFound();
  const { adminListDemos } = await import('@/lib/demos');
  const demos = await adminListDemos(courseId);

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <Link href={`/admin/academy/${courseId}`} className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">← Curriculum</Link>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">Spot-the-mistake — {course.title}</h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">Upload a walkthrough video, then scrub to each moment something is done wrong and mark it with a note. Trainees watch in the portal’s <strong>Exercises</strong> tab and press space to spot mistakes — scored by how many they catch. The mistake timings never reach the player until after they’ve scored.</p>
      <div className="mt-8">
        <DemosManager courseId={courseId} demos={demos} />
      </div>
    </AdminShell>
  );
}
