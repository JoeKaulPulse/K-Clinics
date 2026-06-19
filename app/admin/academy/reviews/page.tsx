import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { ReviewsBoard, type ReviewItem, type QuestionItem } from '@/components/admin/ReviewsBoard';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

// BLD-529: moderation hub — approve/hide course reviews and answer trainee
// discussion / Q&A across all lessons.
export default async function AdminAcademyReviewsPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');

  const { db } = await import('@/lib/db');
  const [reviewRows, questionRows] = await Promise.all([
    db.courseReview.findMany({
      orderBy: [{ createdAt: 'desc' }], take: 200,
      select: { id: true, rating: true, title: true, body: true, authorName: true, status: true, createdAt: true, course: { select: { title: true } } },
    }),
    db.lessonComment.findMany({
      where: { parentId: null, isStaff: false }, orderBy: [{ resolved: 'asc' }, { pinned: 'desc' }, { createdAt: 'desc' }], take: 200,
      select: {
        id: true, authorName: true, body: true, resolved: true, pinned: true, hidden: true, createdAt: true,
        lesson: { select: { title: true, module: { select: { title: true, course: { select: { title: true } } } } } },
        replies: { orderBy: { createdAt: 'asc' }, select: { id: true, authorName: true, body: true, isStaff: true, createdAt: true } },
      },
    }),
  ]);

  // PENDING first, then PUBLISHED, then HIDDEN.
  const order: Record<string, number> = { PENDING: 0, PUBLISHED: 1, HIDDEN: 2 };
  const reviews: ReviewItem[] = reviewRows
    .map((r) => ({ id: r.id, rating: r.rating, title: r.title, body: r.body, authorName: r.authorName, status: r.status, createdAt: r.createdAt.toISOString(), courseTitle: r.course.title }))
    .sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
  const questions: QuestionItem[] = questionRows.map((q) => ({
    id: q.id, authorName: q.authorName, body: q.body, resolved: q.resolved, pinned: q.pinned, hidden: q.hidden, createdAt: q.createdAt.toISOString(),
    courseTitle: q.lesson.module.course.title, moduleTitle: q.lesson.module.title, lessonTitle: q.lesson.title,
    replies: q.replies.map((r) => ({ id: r.id, authorName: r.authorName, body: r.body, isStaff: r.isStaff, createdAt: r.createdAt.toISOString() })),
  }));

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <Link href="/admin/academy" className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">← K Academy</Link>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">Reviews &amp; Q&amp;A</h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">Approve trainee reviews before they appear on the public course page, and answer questions trainees ask inside lessons. Replying marks a question answered and emails the trainee.</p>
      <div className="mt-8">
        <ReviewsBoard reviews={reviews} questions={questions} />
      </div>
    </AdminShell>
  );
}
