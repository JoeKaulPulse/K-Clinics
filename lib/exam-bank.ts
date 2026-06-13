import 'server-only';
import { db } from '@/lib/db';

// ── Exam practice ────────────────────────────────────────────────────────────
// A test-anytime question bank (ExamQuestion) plus historic specimen papers
// (PastPaper). Practice questions are served without their answer keys; grading
// happens server-side, mirroring the course quizzes.

export type PracticeQuestion = { id: string; prompt: string; type: string; options: string[]; tip: string | null };

const strArr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);
const numArr = (v: unknown): number[] => (Array.isArray(v) ? (v as unknown[]).map(Number).filter((n) => Number.isInteger(n)) : []);

/** Courses a signed-in trainee can practise (enrolled and active). */
export async function studentPracticeCourses(studentId: string): Promise<{ id: string; title: string; questionCount: number }[]> {
  const enrols = await db.enrolment.findMany({
    where: { studentId, status: { in: ['PAID', 'ENROLLED', 'COMPLETED'] } },
    select: { course: { select: { id: true, title: true } } },
  });
  const ids = [...new Set(enrols.map((e) => e.course?.id).filter(Boolean) as string[])];
  if (ids.length === 0) return [];
  const counts = await db.examQuestion.groupBy({ by: ['courseId'], where: { active: true, courseId: { in: ids } }, _count: { _all: true } });
  const byId = new Map(counts.map((c) => [c.courseId, c._count._all]));
  const titleById = new Map<string, string>();
  for (const e of enrols) if (e.course) titleById.set(e.course.id, e.course.title);
  return ids.map((id) => ({ id, title: titleById.get(id) ?? 'Course', questionCount: byId.get(id) ?? 0 })).filter((c) => c.questionCount > 0);
}

/** A random practice set, answers stripped. */
export async function generatePractice({ courseId, topic, count = 10 }: { courseId?: string; topic?: string; count?: number }): Promise<PracticeQuestion[]> {
  const rows = await db.examQuestion.findMany({
    where: { active: true, ...(courseId ? { courseId } : {}), ...(topic ? { topic } : {}) },
    select: { id: true, prompt: true, type: true, options: true, tip: true },
  });
  // Fisher–Yates shuffle, then take up to `count` (capped).
  for (let i = rows.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rows[i], rows[j]] = [rows[j], rows[i]]; }
  return rows.slice(0, Math.max(1, Math.min(count, 30))).map((q) => ({ id: q.id, prompt: q.prompt, type: q.type, options: strArr(q.options), tip: q.tip }));
}

/** Grade a single practice question for immediate feedback (records nothing). */
export async function checkPracticeAnswer(questionId: string, answer: number[]): Promise<{ ok: boolean; correct?: boolean; correctIndices?: number[]; explanation?: string | null; error?: string }> {
  const q = await db.examQuestion.findUnique({ where: { id: questionId }, select: { correct: true, explanation: true } });
  if (!q) return { ok: false, error: 'Question not found.' };
  const correctIndices = numArr(q.correct).slice().sort();
  const given = (answer ?? []).slice().sort();
  const correct = correctIndices.length === given.length && correctIndices.every((v, i) => v === given[i]);
  return { ok: true, correct, correctIndices, explanation: q.explanation };
}

/** Record a finished practice run (feeds progress + future leaderboards). */
export async function recordPractice(studentId: string, { courseId, topic, total, correct }: { courseId?: string | null; topic?: string | null; total: number; correct: number }): Promise<{ scorePct: number }> {
  const t = Math.max(0, Math.min(Math.round(total) || 0, 100));
  const c = Math.max(0, Math.min(Math.round(correct) || 0, t));
  const scorePct = t > 0 ? Math.round((c / t) * 100) : 0;
  await db.practiceAttempt.create({ data: { studentId, courseId: courseId || null, topic: topic || null, total: t, correct: c, scorePct } });
  return { scorePct };
}

const BOOTSTRAP_KEY = 'exam_bank_bootstrapped';

/** Self-healing: fill each course's empty bank from its module quizzes and seed a
 *  specimen paper, then flag complete so it stops scanning. Idempotent, run from
 *  the daily cron — so production gets a populated bank without a manual reseed. */
export async function bootstrapExamBankIfNeeded(): Promise<{ ran: boolean; created: number }> {
  const done = await db.setting.findUnique({ where: { key: BOOTSTRAP_KEY } }).catch(() => null);
  if (done?.value === 'true') return { ran: false, created: 0 };
  const courses = await db.course.findMany({ select: { id: true, title: true, accreditations: true } });
  let created = 0;
  for (const c of courses) {
    const board = Array.isArray(c.accreditations) && c.accreditations.length ? c.accreditations[0] : null;
    if ((await db.examQuestion.count({ where: { courseId: c.id } })) === 0) {
      const modules = await db.courseModule.findMany({ where: { courseId: c.id }, select: { title: true, quiz: { select: { questions: { select: { prompt: true, type: true, options: true, correct: true, explanation: true, tip: true } } } } } });
      for (const m of modules) {
        for (const qq of m.quiz?.questions ?? []) {
          await db.examQuestion.create({ data: { courseId: c.id, topic: m.title, difficulty: 'STANDARD', examBoard: board, prompt: qq.prompt, type: qq.type, options: qq.options as object, correct: qq.correct as object, explanation: qq.explanation, tip: qq.tip } });
          created++;
        }
      }
    }
    if ((await db.pastPaper.count({ where: { courseId: c.id } })) === 0) {
      await db.pastPaper.create({ data: { courseId: c.id, title: `${c.title} — specimen exam paper`, examBoard: board, description: 'A specimen paper showing the style, length and command words to expect. Use it to practise timing and exam technique. Your tutor will attach the official paper link here.' } }).catch(() => {});
    }
  }
  await db.setting.upsert({ where: { key: BOOTSTRAP_KEY }, update: { value: 'true' }, create: { key: BOOTSTRAP_KEY, value: 'true' } }).catch(() => {});
  return { ran: true, created };
}

export type PastPaperView = { id: string; title: string; examBoard: string | null; year: number | null; description: string | null; fileUrl: string | null; courseTitle: string | null };

/** Active specimen / past papers (optionally for one course). */
export async function listPastPapers(courseId?: string): Promise<PastPaperView[]> {
  const rows = await db.pastPaper.findMany({
    where: { active: true, ...(courseId ? { courseId } : {}) },
    orderBy: [{ order: 'asc' }, { year: 'desc' }],
    include: { course: { select: { title: true } } },
  });
  return rows.map((p) => ({ id: p.id, title: p.title, examBoard: p.examBoard, year: p.year, description: p.description, fileUrl: p.fileUrl, courseTitle: p.course?.title ?? null }));
}
