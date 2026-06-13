import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { CurriculumManager } from '@/components/admin/CurriculumManager';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function CurriculumPage({ params }: { params: Promise<{ courseId: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');
  const { courseId } = await params;

  const { db } = await import('@/lib/db');
  const course = await db.course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { order: 'asc' },
        include: {
          lessons: { orderBy: { order: 'asc' } },
          quiz: { include: { questions: { orderBy: { order: 'asc' } } } },
        },
      },
    },
  });
  if (!course) notFound();

  const view = {
    id: course.id,
    title: course.title,
    objectives: Array.isArray(course.objectives) ? course.objectives : [],
    welcome: course.welcome,
    modules: course.modules.map((m) => ({
      id: m.id, title: m.title, summary: m.summary,
      lessons: m.lessons.map((l) => ({
        id: l.id, title: l.title, durationMin: l.durationMin, minSeconds: l.minSeconds, videoUrl: l.videoUrl, imageUrl: l.imageUrl,
        body: l.body, keyPoints: Array.isArray(l.keyPoints) ? l.keyPoints : [],
        objectives: Array.isArray(l.objectives) ? l.objectives : [],
        studyTips: Array.isArray(l.studyTips) ? l.studyTips : [],
        homework: l.homework, examRefs: Array.isArray(l.examRefs) ? l.examRefs : [],
        citations: (l.citations as { label: string; url: string }[] | null) ?? [],
        resources: (l.resources as { label: string; url: string }[] | null) ?? [],
      })),
      quiz: m.quiz ? {
        id: m.quiz.id, title: m.quiz.title, passMark: m.quiz.passMark,
        questions: m.quiz.questions.map((q) => ({
          id: q.id, prompt: q.prompt, type: q.type,
          options: (q.options as string[] | null) ?? [],
          correct: (q.correct as number[] | null) ?? [],
          explanation: q.explanation, tip: q.tip, imageUrl: q.imageUrl,
        })),
      } : null,
    })),
  };

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <Link href="/admin/academy" className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">← K Academy</Link>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">Curriculum — {course.title}</h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">Add and edit modules, lessons (video, content, references) and quizzes. Changes are live in the trainee portal immediately and never affect existing trainee progress.</p>
      <div className="mt-8">
        <CurriculumManager course={view} />
      </div>
    </AdminShell>
  );
}
