import 'server-only';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { currentTenantId } from '@/lib/tenant';
import { escapeHtml } from '@/lib/sanitize';

// ── Native LMS engine ────────────────────────────────────────────────────────
// Course content (modules → lessons + a module quiz), per-student progress,
// quiz grading and the trainee calendar. Quiz correct-answers never leave the
// server: the player receives questions without them; grading happens here.

export type LinkRef = { label: string; url: string };
export type AttachmentRef = { label: string; url: string; sizeBytes?: number; kind?: string };
export type LessonType = 'TEXT' | 'VIDEO' | 'AUDIO' | 'PDF' | 'DOWNLOAD' | 'EMBED';
export type HomeworkSubmissionView = { files: string[]; note: string | null; status: string; feedback: string | null };
export type LessonView = {
  id: string; title: string; order: number; durationMin: number | null; minSeconds: number | null;
  type: LessonType; videoUrl: string | null; audioUrl: string | null; embedUrl: string | null; attachments: AttachmentRef[]; videoPositionSec: number;
  imageUrl: string | null; body: string;
  keyPoints: string[]; objectives: string[]; studyTips: string[]; homework: string | null;
  examRefs: string[]; steps: unknown; citations: LinkRef[]; resources: LinkRef[]; pdfUrls: string[]; pdfNoDownload: string[]; requiresHomework: boolean; submission: HomeworkSubmissionView | null; done: boolean; locked: boolean;
};
export type QuizQuestionView = { id: string; order: number; prompt: string; type: string; options: string[]; tip: string | null; imageUrl: string | null; correct?: number[]; acceptedAnswers?: string[]; explanation?: string | null };
export type QuizView = { id: string; title: string; passMark: number; questionCount: number; bestScore: number | null; passed: boolean; timeLimitMin: number | null; maxAttempts: number | null; attemptsUsed: number; shuffleOptions: boolean; isSurvey: boolean; questions: QuizQuestionView[] };
export type ModuleView = { id: string; title: string; summary: string | null; order: number; lessons: LessonView[]; quiz: QuizView | null; complete: boolean; lockedUntil: string | null };
export type CourseLearning = {
  course: { id: string; slug: string; title: string; level: string | null; welcome: string | null; objectives: string[]; preCourseInfo: string | null };
  modules: ModuleView[];
  progressPct: number;
  certificateEligible: boolean;
  preCourseAck: boolean;
};

const arr = (v: unknown): LinkRef[] => (Array.isArray(v) ? (v as LinkRef[]).filter((x) => x && x.label) : []);
const attArr = (v: unknown): AttachmentRef[] => (Array.isArray(v) ? (v as AttachmentRef[]).filter((x) => x && x.label && x.url) : []);
const strArr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

// BLD-529: a quiz pool draws N of the bank. The subset MUST be reproducible
// server-side at grade time (otherwise the grader can't tell which questions were
// issued and a client could submit the whole bank to inflate the score), yet we
// keep no per-attempt record. So the subset is DETERMINISTIC per (student, quiz):
// each learner gets a stable random draw, different learners get different draws,
// and gradeQuiz / checkQuizAnswer recompute the exact same set. Display order can
// still be shuffled freely (order doesn't affect grading).
const poolActive = (total: number, poolSize: number | null | undefined): boolean => !!poolSize && poolSize > 0 && poolSize < total;
const effectiveQuestionCount = (total: number, poolSize: number | null | undefined): number =>
  poolActive(total, poolSize) ? poolSize! : total;

/** Deterministic pooled subset of question ids for a seed (e.g. `${studentId}:${quizId}`). */
function pooledIds(ids: string[], poolSize: number, seed: string): Set<string> {
  const ranked = ids
    .map((id) => ({ id, h: crypto.createHash('sha1').update(`${seed}:${id}`).digest('hex') }))
    .sort((a, b) => (a.h < b.h ? -1 : a.h > b.h ? 1 : 0))
    .slice(0, poolSize)
    .map((x) => x.id);
  return new Set(ranked);
}

/** The questions a learner is issued for a quiz (pooled subset, optionally shuffled
 *  for display). Pass the same seed to gradeQuiz so grading matches what was shown. */
function selectQuizQuestions<T extends { id: string }>(questions: T[], shuffle: boolean, poolSize: number | null | undefined, seed: string): T[] {
  let arr = questions;
  if (poolActive(questions.length, poolSize)) {
    const keep = pooledIds(questions.map((q) => q.id), poolSize!, seed);
    arr = questions.filter((q) => keep.has(q.id));
  }
  if (shuffle) {
    arr = [...arr];
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  }
  return arr;
}

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

/** BLD: per-cohort drip. Module ids NOT yet released for this student's cohort on
 *  the course (a future release date). Empty when the student has no cohort or no
 *  schedule is set — so courses without a release schedule behave exactly as before. */
async function lockedModuleMap(studentId: string, courseId: string): Promise<Map<string, Date>> {
  const enrol = await db.enrolment.findFirst({
    where: { studentId, courseId, status: { in: ['PAID', 'ENROLLED', 'COMPLETED'] }, cohortId: { not: null } },
    select: { cohortId: true },
  });
  if (!enrol?.cohortId) return new Map();
  const rels = await db.cohortModuleRelease.findMany({ where: { cohortId: enrol.cohortId, module: { courseId } }, select: { moduleId: true, releaseAt: true } });
  const now = Date.now();
  const map = new Map<string, Date>();
  for (const r of rels) if (r.releaseAt.getTime() > now) map.set(r.moduleId, r.releaseAt);
  return map;
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
  // BLD-529: resume positions live in LessonPlayback (decoupled from completion).
  const playbackRows = await db.lessonPlayback.findMany({ where: { studentId, lesson: { module: { courseId: course.id } } }, select: { lessonId: true, positionSec: true } });

  const doneSet = new Set(doneRows.map((d) => d.lessonId));
  const posByLesson = new Map(playbackRows.map((p) => [p.lessonId, p.positionSec]));
  const subByLesson = new Map(homeworkRows.map((h) => [h.lessonId, { files: h.files, note: h.note, status: h.status as string, feedback: h.feedback }]));
  const bestByQuiz = new Map<string, { best: number; passed: boolean }>();
  const attemptsByQuiz = new Map<string, number>();
  for (const a of attempts) {
    const cur = bestByQuiz.get(a.quizId);
    bestByQuiz.set(a.quizId, { best: Math.max(cur?.best ?? 0, a.scorePct), passed: (cur?.passed ?? false) || a.passed });
    attemptsByQuiz.set(a.quizId, (attemptsByQuiz.get(a.quizId) ?? 0) + 1);
  }
  // BLD: per-cohort drip — locked modules are listed in the outline but their
  // content (body/video/quiz) is withheld until the release date.
  const lockedMap = await lockedModuleMap(studentId, course.id);

  let totalUnits = 0, doneUnits = 0;
  const moduleViews: ModuleView[] = modules.map((m) => {
    const lockedUntil = lockedMap.get(m.id) ?? null;
    const isLocked = !!lockedUntil;
    const lessons: LessonView[] = m.lessons.map((l) => {
      const done = !isLocked && doneSet.has(l.id);
      totalUnits++; if (done) doneUnits++;
      // Withhold content of locked lessons — only the title shows in the outline.
      if (isLocked) {
        return {
          id: l.id, title: l.title, order: l.order, durationMin: l.durationMin, minSeconds: null,
          type: 'TEXT', videoUrl: null, audioUrl: null, embedUrl: null, attachments: [], videoPositionSec: 0,
          imageUrl: null, body: '', keyPoints: [], objectives: [], studyTips: [],
          homework: null, examRefs: [], steps: null, citations: [], resources: [], pdfUrls: [], pdfNoDownload: [], requiresHomework: false, submission: null, done: false, locked: true,
        };
      }
      return {
        id: l.id, title: l.title, order: l.order, durationMin: l.durationMin, minSeconds: l.minSeconds,
        type: l.type, videoUrl: l.videoUrl, audioUrl: l.audioUrl, embedUrl: l.embedUrl, attachments: attArr(l.attachments), videoPositionSec: posByLesson.get(l.id) ?? 0,
        imageUrl: l.imageUrl, body: l.body,
        keyPoints: strArr(l.keyPoints), objectives: strArr(l.objectives), studyTips: strArr(l.studyTips),
        homework: l.homework, examRefs: strArr(l.examRefs), steps: l.steps, citations: arr(l.citations), resources: arr(l.resources), pdfUrls: strArr(l.pdfUrls), pdfNoDownload: strArr(l.pdfNoDownload), requiresHomework: l.requiresHomework, submission: subByLesson.get(l.id) ?? null, done, locked: false,
      };
    });
    let quiz: QuizView | null = null;
    if (m.quiz) {
      const qz = m.quiz;
      const b = bestByQuiz.get(qz.id);
      totalUnits++; if (!isLocked && b?.passed) doneUnits++;
      // A locked module's quiz is withheld (no questions sent) until release.
      quiz = isLocked ? null : {
        id: qz.id, title: qz.title, passMark: qz.passMark, questionCount: effectiveQuestionCount(qz.questions.length, qz.poolSize),
        bestScore: b?.best ?? null, passed: b?.passed ?? false,
        timeLimitMin: qz.timeLimitMin, maxAttempts: qz.maxAttempts, attemptsUsed: attemptsByQuiz.get(qz.id) ?? 0, shuffleOptions: qz.shuffleOptions, isSurvey: qz.isSurvey,
        // Survey questions and SHORT questions carry no answer options to the learner.
        questions: selectQuizQuestions(qz.questions, qz.shuffleQuestions, qz.poolSize, `${studentId}:${qz.id}`).map((q) => ({ id: q.id, order: q.order, prompt: q.prompt, type: q.type, options: q.type === 'SHORT' ? [] : strArr(q.options), tip: q.tip, imageUrl: q.imageUrl })),
      };
    }
    const complete = !isLocked && lessons.every((l) => l.done) && (!m.quiz || bestByQuiz.get(m.quiz.id)?.passed === true);
    return { id: m.id, title: m.title, summary: m.summary, order: m.order, lessons, quiz, complete, lockedUntil: lockedUntil ? lockedUntil.toISOString() : null };
  });

  const progressPct = totalUnits ? Math.round((doneUnits / totalUnits) * 100) : 0;
  const certificateEligible = moduleViews.length > 0 && moduleViews.every((m) => m.complete);
  return { course, modules: moduleViews, progressPct, certificateEligible, preCourseAck };
}

/** Mark a lesson complete (idempotent). Verifies access. `secondsSpent` (the
 *  dwell time the player measured for this visit) is accumulated, not overwritten. */
export async function completeLesson(studentId: string, lessonId: string, secondsSpent = 0): Promise<{ ok: boolean; newBadges?: { key: string; name: string; icon: string }[] }> {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { moduleId: true, module: { select: { courseId: true } } } });
  if (!lesson) return { ok: false };
  if (!(await studentCanAccess(studentId, lesson.module.courseId))) return { ok: false };
  // BLD: can't complete a lesson in a module that isn't released yet for the cohort.
  if ((await lockedModuleMap(studentId, lesson.module.courseId)).has(lesson.moduleId)) return { ok: false };
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

/** BLD-529: persist the learner's last video playback position so the player can
 *  resume where they left off. Cheap upsert; never marks the lesson complete.
 *  Verifies access and rejects locked modules, same as completeLesson. */
export async function saveVideoPosition(studentId: string, lessonId: string, positionSec: number): Promise<{ ok: boolean }> {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { moduleId: true, module: { select: { courseId: true } } } });
  if (!lesson) return { ok: false };
  if (!(await studentCanAccess(studentId, lesson.module.courseId))) return { ok: false };
  if ((await lockedModuleMap(studentId, lesson.module.courseId)).has(lesson.moduleId)) return { ok: false };
  const pos = Math.max(0, Math.min(Math.round(positionSec) || 0, 24 * 60 * 60)); // sane cap
  const tenantId = await currentTenantId();
  await db.lessonPlayback.upsert({
    where: { studentId_lessonId: { studentId, lessonId } },
    update: { positionSec: pos },
    create: { tenantId, studentId, lessonId, positionSec: pos },
  });
  return { ok: true };
}

/** BLD-529: resolve a lesson PDF's source URL for a student IF they may view it
 *  (enrolled + in access window + module not drip-locked + valid index). Used only
 *  by the authenticated PDF proxy — the public Blob URL is never sent to the page. */
export async function resolveLessonPdf(studentId: string, lessonId: string, index: number): Promise<string | null> {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { moduleId: true, pdfUrls: true, module: { select: { courseId: true } } } });
  if (!lesson) return null;
  const [canAccess, locked] = await Promise.all([studentCanAccess(studentId, lesson.module.courseId), lockedModuleMap(studentId, lesson.module.courseId)]);
  if (!canAccess || locked.has(lesson.moduleId)) return null;
  const url = (Array.isArray(lesson.pdfUrls) ? lesson.pdfUrls : [])[index];
  return url && /^https?:\/\//i.test(url) ? url : null;
}

// ── Engagement & community (BLD-529) ─────────────────────────────────────────
// Per-lesson private notes + threaded discussion/Q&A, and course reviews.

export type CommentView = {
  id: string; authorName: string; isStaff: boolean; body: string;
  pinned: boolean; resolved: boolean; createdAt: string; mine: boolean;
  replies: CommentView[];
};
export type LessonEngagement = { note: string; comments: CommentView[] };

/** A lesson's note + visible discussion thread for a student. Returns empty when
 *  the student can't access the course or the module is drip-locked. */
export async function getLessonEngagement(studentId: string, lessonId: string): Promise<LessonEngagement> {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { moduleId: true, module: { select: { courseId: true } } } });
  if (!lesson) return { note: '', comments: [] };
  // Independent access checks — run them together on this per-lesson-open hot path.
  const [canAccess, locked] = await Promise.all([studentCanAccess(studentId, lesson.module.courseId), lockedModuleMap(studentId, lesson.module.courseId)]);
  if (!canAccess || locked.has(lesson.moduleId)) return { note: '', comments: [] };

  const [noteRow, top] = await Promise.all([
    db.lessonNote.findUnique({ where: { studentId_lessonId: { studentId, lessonId } }, select: { body: true } }),
    db.lessonComment.findMany({
      where: { lessonId, parentId: null, hidden: false },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'asc' }],
      include: { replies: { where: { hidden: false }, orderBy: { createdAt: 'asc' } } },
    }),
  ]);
  const toView = (c: { id: string; authorName: string; isStaff: boolean; body: string; pinned: boolean; resolved: boolean; createdAt: Date; authorStudentId: string | null }): CommentView => ({
    id: c.id, authorName: c.authorName, isStaff: c.isStaff, body: c.body, pinned: c.pinned, resolved: c.resolved,
    createdAt: c.createdAt.toISOString(), mine: c.authorStudentId === studentId, replies: [],
  });
  const comments = top.map((c) => ({ ...toView(c), replies: c.replies.map(toView) }));
  return { note: noteRow?.body ?? '', comments };
}

/** Upsert (or clear) a learner's private note for a lesson. */
export async function saveLessonNote(studentId: string, lessonId: string, body: string): Promise<{ ok: boolean }> {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { moduleId: true, module: { select: { courseId: true } } } });
  if (!lesson) return { ok: false };
  if (!(await studentCanAccess(studentId, lesson.module.courseId))) return { ok: false };
  if ((await lockedModuleMap(studentId, lesson.module.courseId)).has(lesson.moduleId)) return { ok: false };
  const text = (body || '').slice(0, 20000).trim();
  if (!text) { await db.lessonNote.deleteMany({ where: { studentId, lessonId } }); return { ok: true }; }
  const tenantId = await currentTenantId();
  await db.lessonNote.upsert({
    where: { studentId_lessonId: { studentId, lessonId } },
    update: { body: text },
    create: { tenantId, studentId, lessonId, body: text },
  });
  return { ok: true };
}

/** Post a learner comment / question on a lesson (optionally a reply to a
 *  top-level comment). Returns the created comment as a view. */
export async function addLessonComment(studentId: string, lessonId: string, body: string, parentId?: string | null): Promise<{ ok: boolean; error?: string; comment?: CommentView }> {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { moduleId: true, module: { select: { courseId: true } } } });
  if (!lesson) return { ok: false, error: 'Lesson not found.' };
  if (!(await studentCanAccess(studentId, lesson.module.courseId))) return { ok: false, error: 'Not enrolled.' };
  if ((await lockedModuleMap(studentId, lesson.module.courseId)).has(lesson.moduleId)) return { ok: false, error: 'This module hasn’t been released yet.' };
  const text = (body || '').trim().slice(0, 4000);
  if (!text) return { ok: false, error: 'Please write something first.' };
  // One-level threading: a reply must target a top-level comment on this lesson.
  let resolvedParentId: string | null = null;
  if (parentId) {
    const parent = await db.lessonComment.findFirst({ where: { id: parentId, lessonId }, select: { id: true, parentId: true } });
    if (!parent) return { ok: false, error: 'That comment no longer exists.' };
    resolvedParentId = parent.parentId ?? parent.id; // attach to the top-level ancestor
  }
  const student = await db.academyStudent.findUnique({ where: { id: studentId }, select: { firstName: true, lastName: true } });
  const authorName = [student?.firstName, student?.lastName?.slice(0, 1)].filter(Boolean).join(' ') || 'Trainee';
  const tenantId = await currentTenantId();
  const c = await db.lessonComment.create({
    data: { tenantId, lessonId, parentId: resolvedParentId, authorStudentId: studentId, authorName, isStaff: false, body: text },
  });
  return { ok: true, comment: { id: c.id, authorName: c.authorName, isStaff: false, body: c.body, pinned: false, resolved: false, createdAt: c.createdAt.toISOString(), mine: true, replies: [] } };
}

/** A learner removes their own comment (and any replies, via cascade). */
export async function deleteOwnComment(studentId: string, commentId: string): Promise<{ ok: boolean }> {
  const c = await db.lessonComment.findFirst({ where: { id: commentId, authorStudentId: studentId }, select: { id: true } });
  if (!c) return { ok: false };
  await db.lessonComment.delete({ where: { id: c.id } });
  return { ok: true };
}

export type ReviewView = { rating: number; title: string | null; body: string | null; status: string } | null;

/** Fetch a learner's own review for a course (any status), for the edit form. */
export async function getMyReview(studentId: string, courseId: string): Promise<ReviewView> {
  const r = await db.courseReview.findUnique({ where: { studentId_courseId: { studentId, courseId } }, select: { rating: true, title: true, body: true, status: true } });
  return r ? { rating: r.rating, title: r.title, body: r.body, status: r.status } : null;
}

/** Upsert a learner's course review. Only enrolled learners may review; editing
 *  resets the review to PENDING so staff re-moderate before it shows publicly. */
export async function saveCourseReview(studentId: string, courseId: string, rating: number, title: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const enrolled = await db.enrolment.findFirst({ where: { studentId, courseId, status: { in: ['PAID', 'ENROLLED', 'COMPLETED'] } }, select: { id: true } });
  if (!enrolled) return { ok: false, error: 'Only enrolled trainees can review this course.' };
  // Validate the raw rating BEFORE clamping — clamping first would turn a missing
  // 0 into a bogus 1-star and make this guard unreachable.
  const r = Math.round(rating);
  if (!Number.isFinite(r) || r < 1 || r > 5) return { ok: false, error: 'Please choose a star rating from 1 to 5.' };
  const student = await db.academyStudent.findUnique({ where: { id: studentId }, select: { firstName: true, lastName: true } });
  const authorName = [student?.firstName, student?.lastName?.slice(0, 1)].filter(Boolean).join(' ') || 'Trainee';
  const t = title.trim().slice(0, 160) || null;
  const b = body.trim().slice(0, 4000) || null;
  const tenantId = await currentTenantId();
  await db.courseReview.upsert({
    where: { studentId_courseId: { studentId, courseId } },
    update: { rating: r, title: t, body: b, authorName, status: 'PENDING', moderatedBy: null, moderatedAt: null },
    create: { tenantId, courseId, studentId, rating: r, title: t, body: b, authorName, status: 'PENDING' },
  });
  return { ok: true };
}

export type PublicReview = { id: string; rating: number; title: string | null; body: string | null; authorName: string; createdAt: string };
export type CourseRatingSummary = { average: number; count: number; reviews: PublicReview[] };

/** Published reviews + average for the public course page. */
export async function getPublishedReviews(courseId: string, take = 12): Promise<CourseRatingSummary> {
  const [agg, rows] = await Promise.all([
    db.courseReview.aggregate({ where: { courseId, status: 'PUBLISHED' }, _avg: { rating: true }, _count: true }),
    db.courseReview.findMany({ where: { courseId, status: 'PUBLISHED' }, orderBy: { createdAt: 'desc' }, take, select: { id: true, rating: true, title: true, body: true, authorName: true, createdAt: true } }),
  ]);
  return {
    average: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : 0,
    count: agg._count,
    reviews: rows.map((r) => ({ id: r.id, rating: r.rating, title: r.title, body: r.body, authorName: r.authorName, createdAt: r.createdAt.toISOString() })),
  };
}

/** Best-effort email to a learner that staff replied to their question. */
export async function notifyStudentReply(studentId: string, lessonId: string): Promise<void> {
  const [student, lesson] = await Promise.all([
    db.academyStudent.findUnique({ where: { id: studentId }, select: { email: true, firstName: true } }),
    db.lesson.findUnique({ where: { id: lessonId }, select: { title: true, module: { select: { course: { select: { slug: true, title: true } } } } } }),
  ]);
  if (!student?.email || !lesson) return;
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://kclinics.co.uk';
  const url = `${base}/academy/learn/${lesson.module.course.slug}`;
  try {
    const { sendEmail, emailShell } = await import('@/lib/email');
    await sendEmail({
      to: student.email,
      subject: `Your trainer replied — ${lesson.module.course.title}`,
      html: emailShell({
        preheader: 'A K Academy trainer answered your question.',
        body: `<h1 style="font-size:24px;margin:0 0 14px;">Your question was answered</h1>
          <p style="margin:0 0 12px;">Hi ${escapeHtml(student.firstName || 'there')},</p>
          <p style="margin:0 0 12px;">A trainer has replied to your question on <strong>${escapeHtml(lesson.title)}</strong> in <strong>${escapeHtml(lesson.module.course.title)}</strong>.</p>
          <p style="margin:0 0 22px;"><a class="kc-btn" href="${url}" style="display:inline-block;background:#2a2420;color:#f7f1e8;text-decoration:none;padding:13px 26px;border-radius:999px;font-weight:600;">Read the reply &rarr;</a></p>`,
      }),
    });
  } catch { /* best-effort */ }
}

export type GradeResult = {
  ok: boolean; error?: string;
  scorePct?: number; passed?: boolean; passMark?: number;
  results?: { questionId: string; correct: boolean; correctIndices: number[]; explanation: string | null }[];
  newBadges?: { key: string; name: string; icon: string }[];
};

/** Grade a quiz submission server-side and record the attempt. Handles surveys
 *  (ungraded), short-answer (text-matched), question pools and attempt limits. */
export async function gradeQuiz(studentId: string, quizId: string, answers: Record<string, number[] | string>): Promise<GradeResult> {
  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    include: { questions: { orderBy: { order: 'asc' } }, module: { select: { id: true, courseId: true } } },
  });
  if (!quiz) return { ok: false, error: 'Quiz not found.' };
  if (!(await studentCanAccess(studentId, quiz.module.courseId))) return { ok: false, error: 'Not enrolled.' };
  if ((await lockedModuleMap(studentId, quiz.module.courseId)).has(quiz.module.id)) return { ok: false, error: 'This module hasn’t been released yet.' };
  if (quiz.questions.length === 0) return { ok: false, error: 'No questions.' };

  const tenantId = await currentTenantId();

  // Attempt limit (counts every recorded attempt for this learner + quiz).
  if (quiz.maxAttempts && quiz.maxAttempts > 0) {
    const used = await db.quizAttempt.count({ where: { studentId, quizId } });
    if (used >= quiz.maxAttempts) return { ok: false, error: 'You have used all your attempts for this assessment.' };
  }

  // Survey: ungraded — record a completed attempt and return without answer keys.
  if (quiz.isSurvey) {
    await db.quizAttempt.create({ data: { tenantId, studentId, quizId, scorePct: 100, passed: true, answers: answers as object } });
    const { recordDailyTask } = await import('@/lib/academy-daily'); await recordDailyTask(studentId);
    return { ok: true, scorePct: 100, passed: true, passMark: 0, results: [], newBadges: [] };
  }

  // Re-derive the EXACT subset this learner was issued (deterministic per
  // student+quiz) and grade only those — ignoring any extra answers a client
  // might submit, so a pool can't be gamed by answering the whole bank.
  const issued = poolActive(quiz.questions.length, quiz.poolSize)
    ? quiz.questions.filter((q) => pooledIds(quiz.questions.map((x) => x.id), quiz.poolSize!, `${studentId}:${quizId}`).has(q.id))
    : quiz.questions;
  const answeredCount = issued.filter((q) => q.id in answers).length;
  if (answeredCount < issued.length) return { ok: false, error: 'Please answer every question.' };

  let correctCount = 0;
  const results = issued.map((q) => {
    const id = q.id;
    const ans = answers[id];
    let correct: boolean;
    let correctIndices: number[] = [];
    if (q.type === 'SHORT') {
      const accepted = (Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : []).map((s) => String(s).trim().toLowerCase());
      const given = (typeof ans === 'string' ? ans : '').trim().toLowerCase();
      correct = !!given && accepted.includes(given);
    } else {
      correctIndices = (Array.isArray(q.correct) ? (q.correct as number[]) : []).slice().sort((a, b) => a - b);
      const given = (Array.isArray(ans) ? ans : []).slice().sort((a, b) => a - b);
      correct = correctIndices.length === given.length && correctIndices.every((v, i) => v === given[i]);
    }
    if (correct) correctCount++;
    return { questionId: id, correct, correctIndices, explanation: q.explanation };
  });

  const scorePct = issued.length ? Math.min(100, Math.round((correctCount / issued.length) * 100)) : 0;
  const passed = scorePct >= quiz.passMark;
  const priorPass = passed ? await db.quizAttempt.findFirst({ where: { studentId, quizId, passed: true }, select: { id: true } }) : null;
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
export async function checkQuizAnswer(studentId: string, quizId: string, questionId: string, answer: number[] | string): Promise<{ ok: boolean; correct?: boolean; correctIndices?: number[]; explanation?: string | null; error?: string }> {
  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    select: { poolSize: true, module: { select: { courseId: true } }, questions: { select: { id: true, type: true, correct: true, acceptedAnswers: true, explanation: true } } },
  });
  if (!quiz || quiz.questions.length === 0) return { ok: false, error: 'Question not found.' };
  if (!(await studentCanAccess(studentId, quiz.module.courseId))) return { ok: false, error: 'Not enrolled.' };
  // For a pooled quiz, only reveal answers for the subset THIS learner was issued —
  // otherwise the per-question feedback endpoint leaks the whole bank's answer key.
  if (poolActive(quiz.questions.length, quiz.poolSize) && !pooledIds(quiz.questions.map((x) => x.id), quiz.poolSize!, `${studentId}:${quizId}`).has(questionId)) {
    return { ok: false, error: 'Question not found.' };
  }
  const q = quiz.questions.find((x) => x.id === questionId);
  if (!q) return { ok: false, error: 'Question not found.' };
  if (q.type === 'SHORT') {
    const accepted = (Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : []).map((s) => String(s).trim().toLowerCase());
    const given = (typeof answer === 'string' ? answer : '').trim().toLowerCase();
    return { ok: true, correct: !!given && accepted.includes(given), correctIndices: [], explanation: q.explanation };
  }
  const correctIndices = (Array.isArray(q.correct) ? (q.correct as number[]) : []).slice().sort((a, b) => a - b);
  const given = (Array.isArray(answer) ? answer : []).slice().sort((a, b) => a - b);
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
      type: l.type, videoUrl: l.videoUrl, audioUrl: l.audioUrl, embedUrl: l.embedUrl, attachments: attArr(l.attachments), videoPositionSec: 0,
      imageUrl: l.imageUrl, body: l.body,
      keyPoints: strArr(l.keyPoints), objectives: strArr(l.objectives), studyTips: strArr(l.studyTips),
      homework: l.homework, examRefs: strArr(l.examRefs), steps: l.steps, citations: arr(l.citations), resources: arr(l.resources), pdfUrls: strArr(l.pdfUrls), pdfNoDownload: strArr(l.pdfNoDownload), requiresHomework: l.requiresHomework, submission: null, done: false, locked: false,
    }));
    // Preview shows ALL questions (no pool/shuffle) WITH answer keys so the
    // admin can verify content; settings are surfaced so the timer etc. preview too.
    const quiz: QuizView | null = m.quiz ? {
      id: m.quiz.id, title: m.quiz.title, passMark: m.quiz.passMark, questionCount: m.quiz.questions.length, bestScore: null, passed: false,
      timeLimitMin: m.quiz.timeLimitMin, maxAttempts: m.quiz.maxAttempts, attemptsUsed: 0, shuffleOptions: m.quiz.shuffleOptions, isSurvey: m.quiz.isSurvey,
      questions: m.quiz.questions.map((q) => ({
        id: q.id, order: q.order, prompt: q.prompt, type: q.type, options: q.type === 'SHORT' ? [] : strArr(q.options), tip: q.tip, imageUrl: q.imageUrl,
        correct: (Array.isArray(q.correct) ? (q.correct as number[]) : []), acceptedAnswers: strArr(q.acceptedAnswers), explanation: q.explanation,
      })),
    } : null;
    return { id: m.id, title: m.title, summary: m.summary, order: m.order, lessons, quiz, complete: false, lockedUntil: null };
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
