import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { FlashcardsManager } from '@/components/admin/FlashcardsManager';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

// BLD-531: staff author flashcard decks + cards for a course.
export default async function CourseFlashcardsPage({ params }: { params: Promise<{ courseId: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');
  const { courseId } = await params;

  const { db } = await import('@/lib/db');
  const course = await db.course.findUnique({ where: { id: courseId }, select: { title: true } });
  if (!course) notFound();
  const { adminListDecks } = await import('@/lib/flashcards');
  const decks = await adminListDecks(courseId);

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <Link href={`/admin/academy/${courseId}`} className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">← Curriculum</Link>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">Flashcards — {course.title}</h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">Revision decks for this course. Trainees study them in the portal’s <strong>Revise</strong> tab with spaced repetition — cards they find hard resurface more often. Editing here never resets a trainee’s review history (only deleting a card/deck does).</p>
      <div className="mt-8">
        <FlashcardsManager courseId={courseId} decks={decks} />
      </div>
    </AdminShell>
  );
}
