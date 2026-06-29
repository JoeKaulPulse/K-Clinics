import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';
import { normalizeKind } from '@/components/academy/attachment-kinds';

export const runtime = 'nodejs';

// Point-and-click LMS authoring: modules, lessons, quizzes and questions.
// Requires settings.manage. Content changes here never touch trainee progress
// (LessonProgress/QuizAttempt rows are only removed if the parent is deleted).

const num = (v: unknown, d = 0) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : d; };
// BLD-529: optional positive int (blank/0/invalid → null), for quiz time/attempts/pool.
const optInt = (v: unknown): number | null => { if (v === '' || v == null) return null; const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 ? n : null; };
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const linkArr = (v: unknown) => (Array.isArray(v) ? (v as { label?: unknown; url?: unknown }[]).map((x) => ({ label: str(x?.label).slice(0, 160), url: str(x?.url).slice(0, 500) })).filter((x) => x.label && x.url) : []);
const strList = (v: unknown) => (Array.isArray(v) ? (v as unknown[]).map((x) => str(x).slice(0, 300)).filter(Boolean) : []);
// BLD-407: Blob URLs embed the original filename so can exceed 300 chars — use a generous ceiling.
// Only accept absolute http(s) URLs: these are rendered to students as <a href>, so a
// stored javascript:/data: URL would be a stored-XSS vector (React doesn't sanitise href).
const isHttpUrl = (s: string) => /^https?:\/\//i.test(s.trim());
const urlList = (v: unknown) => (Array.isArray(v) ? (v as unknown[]).map((x) => str(x).slice(0, 600).trim()).filter((s) => s && isHttpUrl(s)) : []);
// BLD-529: media URLs may be uploaded Blob URLs with the filename embedded, so use
// a generous ceiling; reject non-http(s) (stored-XSS guard, as these become hrefs/srcs).
const mediaUrl = (v: unknown) => { const s = str(v).slice(0, 1000).trim(); return s && isHttpUrl(s) ? s : null; };
type LessonTypeValue = 'TEXT' | 'VIDEO' | 'AUDIO' | 'PDF' | 'DOWNLOAD' | 'EMBED';
const LESSON_TYPES = new Set<LessonTypeValue>(['TEXT', 'VIDEO', 'AUDIO', 'PDF', 'DOWNLOAD', 'EMBED']);
const lessonType = (v: unknown): LessonTypeValue => { const s = str(v).toUpperCase() as LessonTypeValue; return LESSON_TYPES.has(s) ? s : 'TEXT'; };
type ReviewStatusValue = 'PENDING' | 'PUBLISHED' | 'HIDDEN';
// Strict: returns null for an unrecognised status so the caller can reject it,
// rather than silently defaulting a moderation write to PENDING (which would
// unpublish a live review on a malformed payload).
const reviewStatus = (v: unknown): ReviewStatusValue | null => { const s = str(v).toUpperCase(); return s === 'PUBLISHED' || s === 'HIDDEN' || s === 'PENDING' ? s : null; };
const attachmentArr = (v: unknown) => (Array.isArray(v)
  ? (v as { label?: unknown; url?: unknown; sizeBytes?: unknown; kind?: unknown }[])
      .map((x) => ({ label: str(x?.label).slice(0, 200), url: str(x?.url).slice(0, 1000).trim(), sizeBytes: Number.isFinite(Number(x?.sizeBytes)) && Number(x?.sizeBytes) > 0 ? Math.round(Number(x?.sizeBytes)) : undefined, kind: normalizeKind(str(x?.kind)) }))
      .filter((x) => x.label && x.url && isHttpUrl(x.url))
  : []);

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { db } = await import('@/lib/db');
  const { currentTenantId } = await import('@/lib/tenant');
  const tenantId = await currentTenantId();
  const ok = (extra: object = {}) => NextResponse.json({ ok: true, ...extra });
  const bad = (e = 'Bad request') => NextResponse.json({ ok: false, error: e }, { status: 400 });

  switch (b.op) {
    // ── Course learning meta ───────────────────────────────────────────────────
    case 'updateCourseMeta': {
      if (!b.courseId) return bad();
      const ptRaw = b.portfolioTarget;
      const ptNum = ptRaw === '' || ptRaw == null ? null : Math.round(Number(ptRaw));
      const portfolioTarget = ptNum != null && Number.isFinite(ptNum) ? Math.max(0, Math.min(100, ptNum)) : null;
      await db.course.update({
        where: { id: String(b.courseId) },
        data: { objectives: strList(b.objectives), welcome: str(b.welcome).slice(0, 2000) || null, preCourseInfo: str(b.preCourseInfo).slice(0, 20000) || null, portfolioTarget },
      });
      return ok();
    }

    // ── Modules ──────────────────────────────────────────────────────────────
    case 'createModule': {
      if (!b.courseId) return bad();
      const order = await db.courseModule.count({ where: { courseId: String(b.courseId) } });
      const m = await db.courseModule.create({ data: { tenantId, courseId: String(b.courseId), title: str(b.title).slice(0, 160) || 'New module', summary: str(b.summary).slice(0, 300) || null, order } });
      return ok({ id: m.id });
    }
    case 'updateModule': {
      if (!b.id) return bad();
      await db.courseModule.update({ where: { id: String(b.id) }, data: { title: str(b.title).slice(0, 160), summary: str(b.summary).slice(0, 300) || null } });
      return ok();
    }
    case 'deleteModule': {
      if (!b.id) return bad();
      // Mark the course as manually curated so the daily authored-content
      // enrichment stops re-creating this deleted module (reappearing-modules bug).
      const mod = await db.courseModule.findUnique({ where: { id: String(b.id) }, select: { courseId: true } });
      await db.courseModule.delete({ where: { id: String(b.id) } });
      if (mod) await db.course.update({ where: { id: mod.courseId }, data: { autoEnrich: false } }).catch(() => {});
      return ok();
    }
    case 'reorderModules': {
      if (!Array.isArray(b.ids)) return bad();
      await Promise.all((b.ids as string[]).map((id, i) => db.courseModule.update({ where: { id }, data: { order: i } }).catch(() => {})));
      return ok();
    }

    // ── Lessons ──────────────────────────────────────────────────────────────
    case 'createLesson': {
      if (!b.moduleId) return bad();
      const order = await db.lesson.count({ where: { moduleId: String(b.moduleId) } });
      const l = await db.lesson.create({ data: { tenantId, moduleId: String(b.moduleId), title: str(b.title).slice(0, 160) || 'New lesson', order, body: '' } });
      return ok({ id: l.id });
    }
    case 'updateLesson': {
      if (!b.id) return bad();
      await db.lesson.update({
        where: { id: String(b.id) },
        data: {
          title: str(b.title).slice(0, 160),
          type: lessonType(b.type),
          preview: !!b.preview,
          durationMin: b.durationMin === '' || b.durationMin == null ? null : num(b.durationMin),
          minSeconds: b.minSeconds === '' || b.minSeconds == null ? null : Math.max(0, num(b.minSeconds)),
          videoUrl: mediaUrl(b.videoUrl),
          audioUrl: mediaUrl(b.audioUrl),
          embedUrl: mediaUrl(b.embedUrl),
          attachments: attachmentArr(b.attachments),
          imageUrl: mediaUrl(b.imageUrl),
          body: str(b.body),
          keyPoints: strList(b.keyPoints),
          objectives: strList(b.objectives),
          studyTips: strList(b.studyTips),
          homework: str(b.homework).slice(0, 4000) || null,
          requiresHomework: !!b.requiresHomework,
          examRefs: strList(b.examRefs),
          citations: linkArr(b.citations),
          resources: linkArr(b.resources),
          pdfUrls: urlList(b.pdfUrls),
          pdfNoDownload: urlList(b.pdfNoDownload),
        },
      });
      return ok();
    }
    case 'deleteLesson': {
      if (!b.id) return bad();
      // Same curation guard as deleteModule: stop enrichment resurrecting it.
      const les = await db.lesson.findUnique({ where: { id: String(b.id) }, select: { module: { select: { courseId: true } } } });
      await db.lesson.delete({ where: { id: String(b.id) } });
      if (les?.module) await db.course.update({ where: { id: les.module.courseId }, data: { autoEnrich: false } }).catch(() => {});
      return ok();
    }
    case 'reorderLessons': {
      if (!Array.isArray(b.ids)) return bad();
      await Promise.all((b.ids as string[]).map((id, i) => db.lesson.update({ where: { id }, data: { order: i } }).catch(() => {})));
      return ok();
    }

    // ── Quiz ─────────────────────────────────────────────────────────────────
    case 'upsertQuiz': {
      if (!b.moduleId) return bad();
      const data = {
        title: str(b.title).slice(0, 160) || 'Module assessment',
        passMark: Math.min(100, Math.max(1, num(b.passMark, 70))),
        timeLimitMin: optInt(b.timeLimitMin),
        maxAttempts: optInt(b.maxAttempts),
        shuffleQuestions: !!b.shuffleQuestions,
        shuffleOptions: !!b.shuffleOptions,
        poolSize: optInt(b.poolSize),
        isSurvey: !!b.isSurvey,
      };
      const existing = await db.quiz.findUnique({ where: { moduleId: String(b.moduleId) }, select: { id: true } });
      if (existing) { await db.quiz.update({ where: { id: existing.id }, data }); return ok({ id: existing.id }); }
      const q = await db.quiz.create({ data: { ...data, tenantId, moduleId: String(b.moduleId) } });
      return ok({ id: q.id });
    }
    case 'deleteQuiz': {
      if (!b.id) return bad();
      await db.quiz.delete({ where: { id: String(b.id) } });
      return ok();
    }

    // ── Questions ────────────────────────────────────────────────────────────
    case 'createQuestion': {
      if (!b.quizId) return bad();
      const order = await db.quizQuestion.count({ where: { quizId: String(b.quizId) } });
      const q = await db.quizQuestion.create({ data: { tenantId, quizId: String(b.quizId), order, prompt: 'New question', type: 'SINGLE', options: ['Option 1', 'Option 2'], correct: [0] } });
      return ok({ id: q.id });
    }
    case 'updateQuestion': {
      if (!b.id) return bad();
      const type = ['SINGLE', 'MULTI', 'TRUEFALSE', 'SHORT'].includes(str(b.type)) ? str(b.type) : 'SINGLE';
      const common = { prompt: str(b.prompt).slice(0, 600), type, explanation: str(b.explanation).slice(0, 600) || null, tip: str(b.tip).slice(0, 400) || null, imageUrl: str(b.imageUrl).slice(0, 500) || null };
      // SHORT: text-matched, no options/correct — needs one or more accepted answers.
      if (type === 'SHORT') {
        const acceptedAnswers = (Array.isArray(b.acceptedAnswers) ? (b.acceptedAnswers as unknown[]).map((a) => str(a).slice(0, 200).trim()).filter(Boolean) : []);
        if (acceptedAnswers.length < 1) return bad('Add at least one accepted answer.');
        await db.quizQuestion.update({ where: { id: String(b.id) }, data: { ...common, options: [], correct: [], acceptedAnswers } });
        return ok();
      }
      const options = Array.isArray(b.options) ? (b.options as unknown[]).map((o) => str(o).slice(0, 300)).filter(Boolean) : [];
      let correct = Array.isArray(b.correct) ? (b.correct as unknown[]).map((c) => num(c)).filter((i) => i >= 0 && i < options.length) : [];
      correct = [...new Set(correct)].sort((x, y) => x - y);
      if (options.length < 2) return bad('Add at least two options.');
      if (correct.length < 1) return bad('Mark at least one correct answer.');
      if ((type === 'SINGLE' || type === 'TRUEFALSE') && correct.length !== 1) return bad('Single-answer questions need exactly one correct option.');
      await db.quizQuestion.update({ where: { id: String(b.id) }, data: { ...common, options, correct, acceptedAnswers: [] } });
      return ok();
    }
    case 'deleteQuestion': {
      if (!b.id) return bad();
      await db.quizQuestion.delete({ where: { id: String(b.id) } });
      return ok();
    }
    case 'reorderQuestions': {
      if (!Array.isArray(b.ids)) return bad();
      await Promise.all((b.ids as string[]).map((id, i) => db.quizQuestion.update({ where: { id }, data: { order: i } }).catch(() => {})));
      return ok();
    }

    // ── Engagement moderation (BLD-529): discussion comments + course reviews ──
    case 'staffReply': {
      if (!b.parentId || !str(b.body).trim()) return bad('Missing reply.');
      const parent = await db.lessonComment.findUnique({ where: { id: String(b.parentId) }, select: { id: true, lessonId: true, parentId: true, authorStudentId: true } });
      if (!parent) return bad('Comment not found.');
      const topId = parent.parentId ?? parent.id; // attach reply to the top-level thread
      const authorName = str(session.name) || 'K Academy team';
      const reply = await db.lessonComment.create({ data: { tenantId, lessonId: parent.lessonId, parentId: topId, authorStaff: session.email, authorName, isStaff: true, body: str(b.body).trim().slice(0, 4000) } });
      await db.lessonComment.update({ where: { id: topId }, data: { resolved: true } }).catch(() => {});
      // Best-effort: email the learner who asked.
      const askerId = parent.authorStudentId ?? (await db.lessonComment.findUnique({ where: { id: topId }, select: { authorStudentId: true } }))?.authorStudentId ?? null;
      if (askerId) { const { notifyStudentReply } = await import('@/lib/lms'); notifyStudentReply(askerId, parent.lessonId).catch(() => {}); }
      return ok({ id: reply.id });
    }
    case 'pinComment': { if (!b.id) return bad(); await db.lessonComment.update({ where: { id: String(b.id) }, data: { pinned: !!b.pinned } }); return ok(); }
    case 'resolveComment': { if (!b.id) return bad(); await db.lessonComment.update({ where: { id: String(b.id) }, data: { resolved: !!b.resolved } }); return ok(); }
    case 'hideComment': { if (!b.id) return bad(); await db.lessonComment.update({ where: { id: String(b.id) }, data: { hidden: !!b.hidden } }); return ok(); }
    case 'deleteComment': { if (!b.id) return bad(); await db.lessonComment.delete({ where: { id: String(b.id) } }); return ok(); }
    case 'setReviewStatus': {
      if (!b.id) return bad();
      const status = reviewStatus(b.status);
      if (!status) return bad('Unknown status.');
      await db.courseReview.update({ where: { id: String(b.id) }, data: { status, moderatedBy: session.email, moderatedAt: new Date() } });
      return ok();
    }
    case 'deleteReview': { if (!b.id) return bad(); await db.courseReview.delete({ where: { id: String(b.id) } }); return ok(); }
  }
  return bad('Unknown op');
}
