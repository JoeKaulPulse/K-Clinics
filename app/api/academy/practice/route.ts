import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Test-anytime practice for the signed-in trainee. Mirrors the quiz API: answer
// keys stay server-side; we return questions without them and grade here.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const bank = await import('@/lib/exam-bank');
  const { studentCanAccess } = await import('@/lib/lms');

  if (b.action === 'start') {
    const courseId = b.courseId ? String(b.courseId) : '';
    if (!courseId) return NextResponse.json({ ok: false, error: 'Missing course.' }, { status: 400 });
    if (!(await studentCanAccess(student.id, courseId))) return NextResponse.json({ ok: false, error: 'Not enrolled.' }, { status: 403 });
    const questions = await bank.generatePractice({
      courseId,
      topic: b.topic ? String(b.topic) : undefined,
      count: Number(b.count) || 10,
    });
    if (questions.length === 0) return NextResponse.json({ ok: false, error: 'No practice questions are available yet.' }, { status: 404 });
    return NextResponse.json({ ok: true, questions });
  }
  if (b.action === 'check') {
    const questionId = String(b.questionId || '');
    const questionCourseId = await bank.questionCourseId(questionId);
    if (!questionCourseId || !(await studentCanAccess(student.id, questionCourseId))) {
      return NextResponse.json({ ok: false, error: 'Not enrolled.' }, { status: 403 });
    }
    const answer = Array.isArray(b.answer) ? (b.answer as unknown[]).map(Number).filter((n) => Number.isInteger(n)) : [];
    const res = await bank.checkPracticeAnswer(questionId, answer);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  }
  if (b.action === 'submit') {
    const courseId = b.courseId ? String(b.courseId) : '';
    if (!courseId) return NextResponse.json({ ok: false, error: 'Missing course.' }, { status: 400 });
    if (!(await studentCanAccess(student.id, courseId))) return NextResponse.json({ ok: false, error: 'Not enrolled.' }, { status: 403 });
    const rawAnswers = Array.isArray(b.answers) ? (b.answers as unknown[]).slice(0, 30) : [];
    const seen = new Set<string>();
    const uniqueAnswers: { questionId: string; correct: boolean }[] = [];
    for (const a of rawAnswers) {
      if (!a || typeof a !== 'object') continue;
      const rec = a as Record<string, unknown>;
      if (typeof rec.questionId !== 'string' || !rec.questionId) continue;
      if (typeof rec.correct !== 'boolean') continue;
      if (seen.has(rec.questionId)) continue;
      seen.add(rec.questionId);
      uniqueAnswers.push({ questionId: rec.questionId, correct: rec.correct });
    }
    const total = uniqueAnswers.length;
    const correct = uniqueAnswers.filter((a) => a.correct).length;
    const res = await bank.recordPractice(student.id, {
      courseId,
      topic: b.topic ? String(b.topic) : null,
      total,
      correct,
    });
    return NextResponse.json({ ok: true, ...res });
  }
  return NextResponse.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
}
