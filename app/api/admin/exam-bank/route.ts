import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Manage the exam question bank + past papers. Requires settings.manage.
const num = (v: unknown) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : null; };
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const optList = (v: unknown) => (Array.isArray(v) ? (v as unknown[]).map((o) => str(o).slice(0, 300)).filter(Boolean) : []);

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
    case 'upsertQuestion': {
      const type = ['SINGLE', 'MULTI', 'TRUEFALSE'].includes(str(b.type)) ? str(b.type) : 'SINGLE';
      const options = type === 'TRUEFALSE' ? ['True', 'False'] : optList(b.options);
      let correct = Array.isArray(b.correct) ? (b.correct as unknown[]).map((c) => num(c) ?? -1).filter((i) => i >= 0 && i < options.length) : [];
      correct = [...new Set(correct)].sort((x, y) => x - y);
      if (options.length < 2) return bad('Add at least two options.');
      if (correct.length < 1) return bad('Mark at least one correct answer.');
      if ((type === 'SINGLE' || type === 'TRUEFALSE') && correct.length !== 1) return bad('Single-answer questions need exactly one correct option.');
      const data = {
        courseId: b.courseId ? String(b.courseId) : null,
        topic: str(b.topic).slice(0, 120) || null,
        difficulty: ['FOUNDATION', 'STANDARD', 'STRETCH'].includes(str(b.difficulty)) ? str(b.difficulty) : 'STANDARD',
        examBoard: str(b.examBoard).slice(0, 60) || null,
        prompt: str(b.prompt).slice(0, 800), type, options, correct,
        explanation: str(b.explanation).slice(0, 800) || null,
        tip: str(b.tip).slice(0, 400) || null,
        active: b.active === undefined ? true : !!b.active,
      };
      if (!data.prompt) return bad('Add a question.');
      if (b.id) { await db.examQuestion.update({ where: { id: String(b.id) }, data }); return ok(); }
      const q = await db.examQuestion.create({ data: { ...data, tenantId } });
      return ok({ id: q.id });
    }
    case 'toggleQuestion': {
      if (!b.id) return bad();
      await db.examQuestion.update({ where: { id: String(b.id) }, data: { active: !!b.active } });
      return ok();
    }
    case 'deleteQuestion': {
      if (!b.id) return bad();
      await db.examQuestion.delete({ where: { id: String(b.id) } });
      return ok();
    }
    // Bootstrap / top up the bank from a course's existing module quizzes.
    case 'importFromQuizzes': {
      if (!b.courseId) return bad();
      const courseId = String(b.courseId);
      const course = await db.course.findUnique({ where: { id: courseId }, select: { accreditations: true } });
      const board = course?.accreditations?.[0] ?? null;
      const modules = await db.courseModule.findMany({ where: { courseId }, select: { title: true, quiz: { select: { questions: { select: { prompt: true, type: true, options: true, correct: true, explanation: true, tip: true } } } } } });
      // Avoid duplicating prompts already in the bank for this course.
      const existing = new Set((await db.examQuestion.findMany({ where: { courseId }, select: { prompt: true } })).map((q) => q.prompt));
      let created = 0;
      for (const m of modules) {
        for (const q of m.quiz?.questions ?? []) {
          if (existing.has(q.prompt)) continue;
          await db.examQuestion.create({ data: { tenantId, courseId, topic: m.title, difficulty: 'STANDARD', examBoard: board, prompt: q.prompt, type: q.type, options: q.options as object, correct: q.correct as object, explanation: q.explanation, tip: q.tip } });
          existing.add(q.prompt); created++;
        }
      }
      return ok({ created });
    }
    case 'upsertPaper': {
      const data = {
        courseId: b.courseId ? String(b.courseId) : null,
        title: str(b.title).slice(0, 200), examBoard: str(b.examBoard).slice(0, 60) || null,
        year: num(b.year), description: str(b.description).slice(0, 2000) || null,
        fileUrl: str(b.fileUrl).slice(0, 500) || null, active: b.active === undefined ? true : !!b.active,
        order: num(b.order) ?? 0,
      };
      if (!data.title) return bad('Add a title.');
      if (b.id) { await db.pastPaper.update({ where: { id: String(b.id) }, data }); return ok(); }
      const p = await db.pastPaper.create({ data: { ...data, tenantId } });
      return ok({ id: p.id });
    }
    case 'deletePaper': {
      if (!b.id) return bad();
      await db.pastPaper.delete({ where: { id: String(b.id) } });
      return ok();
    }
  }
  return bad('Unknown op');
}
