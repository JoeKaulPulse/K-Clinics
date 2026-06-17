import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Point-and-click LMS authoring: modules, lessons, quizzes and questions.
// Requires settings.manage. Content changes here never touch trainee progress
// (LessonProgress/QuizAttempt rows are only removed if the parent is deleted).

const num = (v: unknown, d = 0) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : d; };
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const linkArr = (v: unknown) => (Array.isArray(v) ? (v as { label?: unknown; url?: unknown }[]).map((x) => ({ label: str(x?.label).slice(0, 160), url: str(x?.url).slice(0, 500) })).filter((x) => x.label && x.url) : []);
const strList = (v: unknown) => (Array.isArray(v) ? (v as unknown[]).map((x) => str(x).slice(0, 300)).filter(Boolean) : []);
// BLD-407: Blob URLs embed the original filename so can exceed 300 chars — use a generous ceiling.
const urlList = (v: unknown) => (Array.isArray(v) ? (v as unknown[]).map((x) => str(x).slice(0, 600)).filter(Boolean) : []);

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { db } = await import('@/lib/db');
  const ok = (extra: object = {}) => NextResponse.json({ ok: true, ...extra });
  const bad = (e = 'Bad request') => NextResponse.json({ ok: false, error: e }, { status: 400 });

  switch (b.op) {
    // ── Course learning meta ───────────────────────────────────────────────────
    case 'updateCourseMeta': {
      if (!b.courseId) return bad();
      await db.course.update({
        where: { id: String(b.courseId) },
        data: { objectives: strList(b.objectives), welcome: str(b.welcome).slice(0, 2000) || null },
      });
      return ok();
    }

    // ── Modules ──────────────────────────────────────────────────────────────
    case 'createModule': {
      if (!b.courseId) return bad();
      const order = await db.courseModule.count({ where: { courseId: String(b.courseId) } });
      const m = await db.courseModule.create({ data: { courseId: String(b.courseId), title: str(b.title).slice(0, 160) || 'New module', summary: str(b.summary).slice(0, 300) || null, order } });
      return ok({ id: m.id });
    }
    case 'updateModule': {
      if (!b.id) return bad();
      await db.courseModule.update({ where: { id: String(b.id) }, data: { title: str(b.title).slice(0, 160), summary: str(b.summary).slice(0, 300) || null } });
      return ok();
    }
    case 'deleteModule': {
      if (!b.id) return bad();
      await db.courseModule.delete({ where: { id: String(b.id) } });
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
      const l = await db.lesson.create({ data: { moduleId: String(b.moduleId), title: str(b.title).slice(0, 160) || 'New lesson', order, body: '' } });
      return ok({ id: l.id });
    }
    case 'updateLesson': {
      if (!b.id) return bad();
      await db.lesson.update({
        where: { id: String(b.id) },
        data: {
          title: str(b.title).slice(0, 160),
          durationMin: b.durationMin === '' || b.durationMin == null ? null : num(b.durationMin),
          minSeconds: b.minSeconds === '' || b.minSeconds == null ? null : Math.max(0, num(b.minSeconds)),
          videoUrl: str(b.videoUrl).slice(0, 500) || null,
          imageUrl: str(b.imageUrl).slice(0, 500) || null,
          body: str(b.body),
          keyPoints: strList(b.keyPoints),
          objectives: strList(b.objectives),
          studyTips: strList(b.studyTips),
          homework: str(b.homework).slice(0, 4000) || null,
          examRefs: strList(b.examRefs),
          citations: linkArr(b.citations),
          resources: linkArr(b.resources),
          pdfUrls: urlList(b.pdfUrls),
        },
      });
      return ok();
    }
    case 'deleteLesson': {
      if (!b.id) return bad();
      await db.lesson.delete({ where: { id: String(b.id) } });
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
      const data = { title: str(b.title).slice(0, 160) || 'Module assessment', passMark: Math.min(100, Math.max(1, num(b.passMark, 70))) };
      const existing = await db.quiz.findUnique({ where: { moduleId: String(b.moduleId) }, select: { id: true } });
      if (existing) { await db.quiz.update({ where: { id: existing.id }, data }); return ok({ id: existing.id }); }
      const q = await db.quiz.create({ data: { ...data, moduleId: String(b.moduleId) } });
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
      const q = await db.quizQuestion.create({ data: { quizId: String(b.quizId), order, prompt: 'New question', type: 'SINGLE', options: ['Option 1', 'Option 2'], correct: [0] } });
      return ok({ id: q.id });
    }
    case 'updateQuestion': {
      if (!b.id) return bad();
      const type = ['SINGLE', 'MULTI', 'TRUEFALSE'].includes(str(b.type)) ? str(b.type) : 'SINGLE';
      const options = Array.isArray(b.options) ? (b.options as unknown[]).map((o) => str(o).slice(0, 300)).filter(Boolean) : [];
      let correct = Array.isArray(b.correct) ? (b.correct as unknown[]).map((c) => num(c)).filter((i) => i >= 0 && i < options.length) : [];
      correct = [...new Set(correct)].sort((x, y) => x - y);
      if (options.length < 2) return bad('Add at least two options.');
      if (correct.length < 1) return bad('Mark at least one correct answer.');
      if ((type === 'SINGLE' || type === 'TRUEFALSE') && correct.length !== 1) return bad('Single-answer questions need exactly one correct option.');
      await db.quizQuestion.update({ where: { id: String(b.id) }, data: { prompt: str(b.prompt).slice(0, 600), type, options, correct, explanation: str(b.explanation).slice(0, 600) || null, tip: str(b.tip).slice(0, 400) || null, imageUrl: str(b.imageUrl).slice(0, 500) || null } });
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
  }
  return bad('Unknown op');
}
