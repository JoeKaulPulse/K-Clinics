import 'server-only';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { currentTenantId } from '@/lib/tenant';

// ── Native LMS engine ────────────────────────────────────────────────────────
// Course content (modules → lessons + a module quiz), per-student progress,
// quiz grading and the trainee calendar. Quiz correct-answers never leave the
// server: the player receives questions without them; grading happens here.

export type LinkRef = { label: string; url: string };
export type HomeworkSubmissionView = { files: string[]; note: string | null; status: string; feedback: string | null };
export type LessonView = {
  id: string; title: string; order: number; durationMin: number | null; minSeconds: number | null;
  videoUrl: string | null; imageUrl: string | null; body: string;
  keyPoints: string[]; objectives: string[]; studyTips: string[]; homework: string | null;
  examRefs: string[]; steps: unknown; citations: LinkRef[]; resources: LinkRef[]; pdfUrls: string[]; pdfNoDownload: string[]; requiresHomework: boolean; submission: HomeworkSubmissionView | null; done: boolean;
};
export type QuizQuestionView = { id: string; order: number; prompt: string; type: string; options: string[]; tip: string | null; imageUrl: string | null; correct?: number[]; explanation?: string | null };
export type QuizView = { id: string; title: string; passMark: number; questionCount: number; bestScore: number | null; passed: boolean; questions: QuizQuestionView[] };
export type ModuleView = { id: string; title: string; summary: string | null; order: number; lessons: LessonView[]; quiz: QuizView | null; complete: boolean };
export type CourseLearning = {
  course: { id: string; slug: string; title: string; level: string | null; welcome: string | null; objectives: string[]; preCourseInfo: string | null };
  modules: ModuleView[];
  progressPct: number;
  certificateEligible: boolean;
  preCourseAck: boolean;
};

const arr = (v: unknown): LinkRef[] => (Array.isArray(v) ? (v as LinkRef[]).filter((x) => x && x.label) : []);
const strArr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

/** Is the student allowed into a course's content? (paid / enrolled / completed) */
export async function studentCanAccess(studentId: string, courseId: string): Promise<boolean> {
  const enrols = await db.enrolment.findMany({
    where: { studentId, courseId, status: { in: ['PAID', 'ENROLLED', 'COMPLETED'] } },
    select: { cohort: { select: { accessStartAt: true, accessEndAt: true } } },
  });
  // BLD-408: a cohort can set a course-access window. Access is granted if any
  // enrolment is currently in-window — no dates set means always open, so existing
  // cohorts are unchanged. Before accessStartAt it's not yet available; after
  // accessEndAt it has expired.
  const now = Date.now();
  return enrols.some((e) => {
    const start = e.cohort?.accessStartAt, end = e.cohort?.accessEndAt;
    if (start && now < start.getTime()) return false;
    if (end && now > end.getTime()) return false;
    return true;
  });
}

/** Full learning view for a student: content + progress (no correct answers). */
export async function getCourseLearning(slug: string, studentId: string): Promise<CourseLearning | null> {
  // findFirst (not findUnique): slug is unique per-tenant now (@@unique([tenantId, slug]));
  // the tenant scope is injected by the db extension (lib/tenant-scope.ts).
  const course = await db.course.findFirst({ where: { slug }, select: { id: true, slug: true, title: true, level: true, welcome: true, objectives: true, preCourseInfo: true } });
  if (!course) return null;
  if (!(await studentCanAccess(studentId, course.id))) return null;

  // BLD-445: has the learner acknowledged the mandatory pre-course page?
  const enrol = await db.enrolment.findFirst({ where: { studentId, courseId: course.id, status: { in: ['PAID', 'ENROLLED', 'COMPLETED'] } }, select: { preCourseAckAt: true } });
  const preCourseAck = !!enrol?.preCourseAckAt;

  const [modules, doneRows, attempts, homeworkRows] = await Promise.all([
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
    db.homeworkSubmission.findMany({ where: { studentId, lesson: { module: { courseId: course.id } } }, select: { lessonId: true, files: true, note: true, status: true, feedback: true } }),
  ]);

  const doneSet = new Set(doneRows.map((d) => d.lessonId));
  const subByLesson = new Map(homeworkRows.map((h) => [h.lessonId, { files: h.files, note: h.note, status: h.status as string, feedback: h.feedback }]));
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
        id: l.id, title: l.title, order: l.order, durationMin: l.durationMin, minSeconds: l.minSeconds,
        videoUrl: l.videoUrl, imageUrl: l.imageUrl, body: l.body,
        keyPoints: strArr(l.keyPoints), objectives: strArr(l.objectives), studyTips: strArr(l.studyTips),
        homework: l.homework, examRefs: strArr(l.examRefs), steps: l.steps, citations: arr(l.citations), resources: arr(l.resources), pdfUrls: strArr(l.pdfUrls), pdfNoDownload: strArr(l.pdfNoDownload), requiresHomework: l.requiresHomework, submission: subByLesson.get(l.id) ?? null, done,
      };
    });
    let quiz: QuizView | null = null;
    if (m.quiz) {
      const b = bestByQuiz.get(m.quiz.id);
      totalUnits++; if (b?.passed) doneUnits++;
      quiz = {
        id: m.quiz.id, title: m.quiz.title, passMark: m.quiz.passMark, questionCount: m.quiz.questions.length,
        bestScore: b?.best ?? null, passed: b?.passed ?? false,
        questions: m.quiz.questions.map((q) => ({ id: q.id, order: q.order, prompt: q.prompt, type: q.type, options: strArr(q.options), tip: q.tip, imageUrl: q.imageUrl })),
      };
    }
    const complete = lessons.every((l) => l.done) && (!quiz || quiz.passed);
    return { id: m.id, title: m.title, summary: m.summary, order: m.order, lessons, quiz, complete };
  });

  const progressPct = totalUnits ? Math.round((doneUnits / totalUnits) * 100) : 0;
  const certificateEligible = moduleViews.length > 0 && moduleViews.every((m) => m.complete);
  return { course, modules: moduleViews, progressPct, certificateEligible, preCourseAck };
}

/** Mark a lesson complete (idempotent). Verifies access. `secondsSpent` (the
 *  dwell time the player measured for this visit) is accumulated, not overwritten. */
export async function completeLesson(studentId: string, lessonId: string, secondsSpent = 0): Promise<{ ok: boolean; newBadges?: { key: string; name: string; icon: string }[] }> {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { module: { select: { courseId: true } } } });
  if (!lesson) return { ok: false };
  if (!(await studentCanAccess(studentId, lesson.module.courseId))) return { ok: false };
  const secs = Math.max(0, Math.min(Math.round(secondsSpent) || 0, 6 * 60 * 60)); // cap at 6h to ignore idle tabs
  const firstTime = !(await db.lessonProgress.findUnique({ where: { studentId_lessonId: { studentId, lessonId } }, select: { id: true } }));
  const tenantId = await currentTenantId();
  await db.lessonProgress.upsert({
    where: { studentId_lessonId: { studentId, lessonId } },
    update: secs > 0 ? { secondsSpent: { increment: secs } } : {},
    create: { tenantId, studentId, lessonId, secondsSpent: secs },
  });
  let newBadges: { key: string; name: string; icon: string }[] = [];
  if (firstTime) {
    const { scoreAndBadge, XP } = await import('@/lib/academy-gamification');
    newBadges = await scoreAndBadge(studentId, 'LESSON', XP.LESSON, lesson.module.courseId);
    const { recordDailyTask } = await import('@/lib/academy-daily'); await recordDailyTask(studentId);
  }
  return { ok: true, newBadges };
}

export type GradeResult = {
  ok: boolean; error?: string;
  scorePct?: number; passed?: boolean; passMark?: number;
  results?: { questionId: string; correct: boolean; correctIndices: number[]; explanation: string | null }[];
  newBadges?: { key: string; name: string; icon: string }[];
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
  const priorPass = passed ? await db.quizAttempt.findFirst({ where: { studentId, quizId, passed: true }, select: { id: true } }) : null;
  const tenantId = await currentTenantId();
  await db.quizAttempt.create({ data: { tenantId, studentId, quizId, scorePct, passed, answers: answers as object } });
  let newBadges: { key: string; name: string; icon: string }[] = [];
  if (passed && !priorPass) {
    const { scoreAndBadge, XP } = await import('@/lib/academy-gamification');
    newBadges = await scoreAndBadge(studentId, 'QUIZ', XP.QUIZ_PASS + (scorePct === 100 ? XP.QUIZ_PERFECT_BONUS : 0), quiz.module.courseId);
    const { recordDailyTask } = await import('@/lib/academy-daily'); await recordDailyTask(studentId);
  }
  return { ok: true, scorePct, passed, passMark: quiz.passMark, results, newBadges };
}

/** Grade a SINGLE question for immediate (Duolingo-style) feedback. Verifies
 *  access. Does not record an attempt — the full quiz is recorded via gradeQuiz
 *  when the learner finishes. Reveals only this question's answer. */
export async function checkQuizAnswer(studentId: string, quizId: string, questionId: string, answer: number[]): Promise<{ ok: boolean; correct?: boolean; correctIndices?: number[]; explanation?: string | null; error?: string }> {
  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    select: { module: { select: { courseId: true } }, questions: { where: { id: questionId }, select: { correct: true, explanation: true } } },
  });
  if (!quiz || quiz.questions.length === 0) return { ok: false, error: 'Question not found.' };
  if (!(await studentCanAccess(studentId, quiz.module.courseId))) return { ok: false, error: 'Not enrolled.' };
  const q = quiz.questions[0];
  const correctIndices = (Array.isArray(q.correct) ? (q.correct as number[]) : []).slice().sort();
  const given = (answer ?? []).slice().sort();
  const correct = correctIndices.length === given.length && correctIndices.every((v, i) => v === given[i]);
  return { ok: true, correct, correctIndices, explanation: q.explanation };
}

/** Admin-only course preview: the full learning view for a course by id, with
 *  no student/progress and WITH answer keys (so the immersive player can grade
 *  client-side). Guard the caller with settings.manage — never expose to trainees. */
export async function getCoursePreview(courseId: string): Promise<CourseLearning | null> {
  const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true, slug: true, title: true, level: true, welcome: true, objectives: true, preCourseInfo: true } });
  if (!course) return null;
  const modules = await db.courseModule.findMany({
    where: { courseId },
    orderBy: { order: 'asc' },
    include: { lessons: { orderBy: { order: 'asc' } }, quiz: { include: { questions: { orderBy: { order: 'asc' } } } } },
  });
  const moduleViews: ModuleView[] = modules.map((m) => {
    const lessons: LessonView[] = m.lessons.map((l) => ({
      id: l.id, title: l.title, order: l.order, durationMin: l.durationMin, minSeconds: l.minSeconds,
      videoUrl: l.videoUrl, imageUrl: l.imageUrl, body: l.body,
      keyPoints: strArr(l.keyPoints), objectives: strArr(l.objectives), studyTips: strArr(l.studyTips),
      homework: l.homework, examRefs: strArr(l.examRefs), steps: l.steps, citations: arr(l.citations), resources: arr(l.resources), pdfUrls: strArr(l.pdfUrls), pdfNoDownload: strArr(l.pdfNoDownload), requiresHomework: l.requiresHomework, submission: null, done: false,
    }));
    const quiz: QuizView | null = m.quiz ? {
      id: m.quiz.id, title: m.quiz.title, passMark: m.quiz.passMark, questionCount: m.quiz.questions.length, bestScore: null, passed: false,
      questions: m.quiz.questions.map((q) => ({
        id: q.id, order: q.order, prompt: q.prompt, type: q.type, options: strArr(q.options), tip: q.tip, imageUrl: q.imageUrl,
        correct: (Array.isArray(q.correct) ? (q.correct as number[]) : []), explanation: q.explanation,
      })),
    } : null;
    return { id: m.id, title: m.title, summary: m.summary, order: m.order, lessons, quiz, complete: false };
  });
  return { course, modules: moduleViews, progressPct: 0, certificateEligible: false, preCourseAck: true };
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

// ── Verifiable certificate (BLD-528) ─────────────────────────────────────────
// On theory completion we issue a STORED, verifiable reference (not a derived
// string), so anyone can confirm it at /academy/verify/<ref>. Uniqueness is
// self-healed by retrying on collision — no DB @unique (deploy-gate safe).
const certToken = () => `KA-${crypto.randomBytes(2).toString('hex').toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

/** Issue (or return the existing) certificate reference for a student+course.
 *  Only the enrolment that grants access is stamped. Idempotent. */
export async function issueCertificate(studentId: string, courseId: string): Promise<{ ref: string; issuedAt: Date } | null> {
  const enrol = await db.enrolment.findFirst({
    where: { studentId, courseId, status: { in: ['PAID', 'ENROLLED', 'COMPLETED'] } },
    select: { id: true, certificateRef: true, certificateIssuedAt: true },
  });
  if (!enrol) return null;
  if (enrol.certificateRef && enrol.certificateIssuedAt) return { ref: enrol.certificateRef, issuedAt: enrol.certificateIssuedAt };
  for (let i = 0; i < 5; i++) {
    const ref = certToken();
    const clash = await db.enrolment.findFirst({ where: { certificateRef: ref }, select: { id: true } });
    if (clash) continue;
    try {
      const updated = await db.enrolment.update({ where: { id: enrol.id }, data: { certificateRef: ref, certificateIssuedAt: enrol.certificateIssuedAt ?? new Date() }, select: { certificateRef: true, certificateIssuedAt: true } });
      return { ref: updated.certificateRef as string, issuedAt: updated.certificateIssuedAt as Date };
    } catch { /* retry on the rare unique race */ }
  }
  return null;
}

export type CertificateCheck = { ok: true; name: string; courseTitle: string; level: string | null; accreditations: string[]; issuedAt: Date } | { ok: false };

/** Public verification of a certificate reference. */
export async function verifyCertificate(ref: string): Promise<CertificateCheck> {
  if (!ref || ref.length > 40) return { ok: false };
  const e = await db.enrolment.findFirst({
    where: { certificateRef: ref.toUpperCase() },
    select: { certificateIssuedAt: true, applicantName: true, student: { select: { firstName: true, lastName: true } }, course: { select: { title: true, level: true, accreditations: true } } },
  });
  if (!e || !e.certificateIssuedAt) return { ok: false };
  const name = e.student ? [e.student.firstName, e.student.lastName].filter(Boolean).join(' ') : e.applicantName;
  return { ok: true, name, courseTitle: e.course.title, level: e.course.level, accreditations: e.course.accreditations, issuedAt: e.certificateIssuedAt };
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
