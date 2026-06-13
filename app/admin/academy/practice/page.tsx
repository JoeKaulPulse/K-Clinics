import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { ExamBankManager } from '@/components/admin/ExamBankManager';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function AdminExamPracticePage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');

  const { db } = await import('@/lib/db');
  const [courses, questions, papers] = await Promise.all([
    db.course.findMany({ orderBy: [{ order: 'asc' }], select: { id: true, title: true } }),
    db.examQuestion.findMany({ orderBy: { createdAt: 'desc' }, take: 1000 }),
    db.pastPaper.findMany({ orderBy: [{ order: 'asc' }, { year: 'desc' }] }),
  ]);

  const qView = questions.map((q) => ({
    id: q.id, courseId: q.courseId, topic: q.topic, difficulty: q.difficulty, examBoard: q.examBoard,
    prompt: q.prompt, type: q.type, options: (q.options as string[] | null) ?? [], correct: (q.correct as number[] | null) ?? [],
    explanation: q.explanation, tip: q.tip, active: q.active,
  }));
  const pView = papers.map((p) => ({ id: p.id, courseId: p.courseId, title: p.title, examBoard: p.examBoard, year: p.year, description: p.description, fileUrl: p.fileUrl, active: p.active, order: p.order }));

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <Link href="/admin/academy" className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">← K Academy</Link>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">Exam practice</h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">The test-anytime question bank trainees practise from, plus the specimen / past papers shown alongside it. Import a course’s quiz questions to fill the bank in one click.</p>
      <div className="mt-8">
        <ExamBankManager courses={courses} questions={qView} papers={pView} />
      </div>
    </AdminShell>
  );
}
