import 'server-only';
import { db } from '@/lib/db';

// ── Native LMS engine ────────────────────────────────────────────────────────
// Course content (modules → lessons + a module quiz), per-student progress,
// quiz grading and the trainee calendar. Quiz correct-answers never leave the
// server: the player receives questions without them; grading happens here.

export type LinkRef = { label: string; url: string };
export type LessonView = {
  id: string; title: string; order: number; durationMin: number | null;
  videoUrl: string | null; imageUrl: string | null; body: string;
  keyPoints: string[]; citations: LinkRef[]; resources: LinkRef[]; done: boolean;
};
export type QuizQuestionView = { id: string; order: number; prompt: string; type: string; options: string[]; imageUrl: string | null };
export type QuizView = { id: string; title: string; passMark: number; questionCount: number; bestScore: number | null; passed: boolean; questions: QuizQuestionView[] };
export type ModuleView = { id: string; title: string; summary: string | null; order: number; lessons: LessonView[]; quiz: QuizView | null; complete: boolean };
export type CourseLearning = {
  course: { id: string; slug: string; title: string; level: string | null };
  modules: ModuleView[];
  progressPct: number;
  certificateEligible: boolean;
};

const arr = (v: unknown): LinkRef[] => (Array.isArray(v) ? (v as LinkRef[]).filter((x) => x && x.label) : []);
const strArr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

/** Is the student allowed into a course's content? (paid / enrolled / completed) */
export async function studentCanAccess(studentId: string, courseId: string): Promise<boolean> {
  const e = await db.enrolment.findFirst({
    where: { studentId, courseId, status: { in: ['PAID', 'ENROLLED', 'COMPLETED'] } },
    select: { id: true },
  });
  return Boolean(e);
}

/** Full learning view for a student: content + progress (no correct answers). */
export async function getCourseLearning(slug: string, studentId: string): Promise<CourseLearning | null> {
  const course = await db.course.findUnique({ where: { slug }, select: { id: true, slug: true, title: true, level: true } });
  if (!course) return null;
  if (!(await studentCanAccess(studentId, course.id))) return null;

  const [modules, doneRows, attempts] = await Promise.all([
    db.courseModule.findMany({
      where: { courseId: course.id },
      orderBy: { order: 'asc' },
      include: {
        lessons: { orderBy: { order: 'asc' } },
        quiz: { include: { questions: { orderBy: { order: 'asc' } } } },
      },
    }),
    db.lessonProgress.findMany({ where: { studentId, lesson: { module: { courseId: course.id } } }, select: { lessonId: true } }),
    db.quizAttempt.findMany({ where: { studentId, quiz: { module: { courseId: course.id } } }, select: { quizId: true, scorePct: true, passed: true } }),
  ]);

  const doneSet = new Set(doneRows.map((d) => d.lessonId));
  const bestByQuiz = new Map<string, { best: number; passed: boolean }>();
  for (const a of attempts) {
    const cur = bestByQuiz.get(a.quizId);
    bestByQuiz.set(a.quizId, { best: Math.max(cur?.best ?? 0, a.scorePct), passed: (cur?.passed ?? false) || a.passed });
  }

  let totalUnits = 0, doneUnits = 0;
  const moduleViews: ModuleView[] = modules.map((m) => {
    const lessons: LessonView[] = m.lessons.map((l) => {
      const done = doneSet.has(l.id);
      totalUnits++; if (done) doneUnits++;
      return {
        id: l.id, title: l.title, order: l.order, durationMin: l.durationMin,
        videoUrl: l.videoUrl, imageUrl: l.imageUrl, body: l.body,
        keyPoints: strArr(l.keyPoints), citations: arr(l.citations), resources: arr(l.resources), done,
      };
    });
    let quiz: QuizView | null = null;
    if (m.quiz) {
      const b = bestByQuiz.get(m.quiz.id);
      totalUnits++; if (b?.passed) doneUnits++;
      quiz = {
        id: m.quiz.id, title: m.quiz.title, passMark: m.quiz.passMark, questionCount: m.quiz.questions.length,
        bestScore: b?.best ?? null, passed: b?.passed ?? false,
        questions: m.quiz.questions.map((q) => ({ id: q.id, order: q.order, prompt: q.prompt, type: q.type, options: strArr(q.options), imageUrl: q.imageUrl })),
      };
    }
    const complete = lessons.every((l) => l.done) && (!quiz || quiz.passed);
    return { id: m.id, title: m.title, summary: m.summary, order: m.order, lessons, quiz, complete };
  });

  const progressPct = totalUnits ? Math.round((doneUnits / totalUnits) * 100) : 0;
  const certificateEligible = moduleViews.length > 0 && moduleViews.every((m) => m.complete);
  return { course, modules: moduleViews, progressPct, certificateEligible };
}

/** Mark a lesson complete (idempotent). Verifies access. */
export async function completeLesson(studentId: string, lessonId: string): Promise<{ ok: boolean }> {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { module: { select: { courseId: true } } } });
  if (!lesson) return { ok: false };
  if (!(await studentCanAccess(studentId, lesson.module.courseId))) return { ok: false };
  await db.lessonProgress.upsert({
    where: { studentId_lessonId: { studentId, lessonId } },
    update: {},
    create: { studentId, lessonId },
  });
  return { ok: true };
}

export type GradeResult = {
  ok: boolean; error?: string;
  scorePct?: number; passed?: boolean; passMark?: number;
  results?: { questionId: string; correct: boolean; correctIndices: number[]; explanation: string | null }[];
};

/** Grade a quiz submission server-side and record the attempt. */
export async function gradeQuiz(studentId: string, quizId: string, answers: Record<string, number[]>): Promise<GradeResult> {
  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    include: { questions: { orderBy: { order: 'asc' } }, module: { select: { courseId: true } } },
  });
  if (!quiz) return { ok: false, error: 'Quiz not found.' };
  if (!(await studentCanAccess(studentId, quiz.module.courseId))) return { ok: false, error: 'Not enrolled.' };
  if (quiz.questions.length === 0) return { ok: false, error: 'No questions.' };

  let correctCount = 0;
  const results = quiz.questions.map((q) => {
    const correctIndices = (Array.isArray(q.correct) ? (q.correct as number[]) : []).slice().sort();
    const given = (answers[q.id] ?? []).slice().sort();
    const correct = correctIndices.length === given.length && correctIndices.every((v, i) => v === given[i]);
    if (correct) correctCount++;
    return { questionId: q.id, correct, correctIndices, explanation: q.explanation };
  });

  const scorePct = Math.round((correctCount / quiz.questions.length) * 100);
  const passed = scorePct >= quiz.passMark;
  await db.quizAttempt.create({ data: { studentId, quizId, scorePct, passed, answers: answers as object } });
  return { ok: true, scorePct, passed, passMark: quiz.passMark, results };
}

/** Lean progress % for one course (for the portal list). 0–100, or null if the
 *  course has no LMS content yet. */
export async function courseProgress(studentId: string, courseId: string): Promise<{ pct: number; hasContent: boolean }> {
  const [lessonTotal, quizTotal, doneLessons, passedQuizRows] = await Promise.all([
    db.lesson.count({ where: { module: { courseId } } }),
    db.quiz.count({ where: { module: { courseId } } }),
    db.lessonProgress.count({ where: { studentId, lesson: { module: { courseId } } } }),
    db.quizAttempt.findMany({ where: { studentId, passed: true, quiz: { module: { courseId } } }, select: { quizId: true }, distinct: ['quizId'] }),
  ]);
  const total = lessonTotal + quizTotal;
  if (total === 0) return { pct: 0, hasContent: false };
  const done = Math.min(doneLessons, lessonTotal) + passedQuizRows.length;
  return { pct: Math.round((done / total) * 100), hasContent: true };
}

export type CalendarEvent = { id: string; kind: 'live' | 'practical'; courseTitle: string; title: string; startAt: Date; endAt: Date | null; joinUrl: string | null; location: string | null; trainer: string | null };

/** Upcoming live (Google Meet) classes + in-person practical dates for the
 *  courses a student is enrolled on. */
export async function getStudentCalendar(studentId: string): Promise<CalendarEvent[]> {
  const enrols = await db.enrolment.findMany({
    where: { studentId, status: { in: ['PAID', 'ENROLLED', 'COMPLETED'] } },
    select: { courseId: true, cohortId: true, course: { select: { title: true } } },
  });
  if (enrols.length === 0) return [];
  const courseIds = [...new Set(enrols.map((e) => e.courseId))];
  const titleByCourse = new Map(enrols.map((e) => [e.courseId, e.course.title]));
  const cohortIds = enrols.map((e) => e.cohortId).filter(Boolean) as string[];
  const now = new Date();

  const [live, cohorts] = await Promise.all([
    db.liveClass.findMany({ where: { courseId: { in: courseIds }, startAt: { gte: new Date(now.getTime() - 36e5) } }, orderBy: { startAt: 'asc' } }),
    cohortIds.length ? db.cohort.findMany({ where: { id: { in: cohortIds } }, include: { course: { select: { title: true } } } }) : Promise.resolve([]),
  ]);

  const events: CalendarEvent[] = [
    ...live.map((l) => ({ id: l.id, kind: 'live' as const, courseTitle: titleByCourse.get(l.courseId) ?? '', title: l.title, startAt: l.startAt, endAt: l.endAt, joinUrl: l.joinUrl, location: 'Online · Google Meet', trainer: l.trainer })),
    ...cohorts.map((c) => ({ id: c.id, kind: 'practical' as const, courseTitle: c.course.title, title: 'Practical training', startAt: c.startAt, endAt: c.endAt, joinUrl: null, location: c.location ?? 'K Academy, Islington', trainer: c.trainer })),
  ];
  return events.sort((a, b) => +a.startAt - +b.startAt);
}
