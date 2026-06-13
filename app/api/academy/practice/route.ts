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

  if (b.action === 'start') {
    const questions = await bank.generatePractice({
      courseId: b.courseId ? String(b.courseId) : undefined,
      topic: b.topic ? String(b.topic) : undefined,
      count: Number(b.count) || 10,
    });
    if (questions.length === 0) return NextResponse.json({ ok: false, error: 'No practice questions are available yet.' }, { status: 404 });
    return NextResponse.json({ ok: true, questions });
  }
  if (b.action === 'check') {
    const answer = Array.isArray(b.answer) ? (b.answer as unknown[]).map(Number).filter((n) => Number.isInteger(n)) : [];
    const res = await bank.checkPracticeAnswer(String(b.questionId || ''), answer);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  }
  if (b.action === 'submit') {
    const res = await bank.recordPractice(student.id, {
      courseId: b.courseId ? String(b.courseId) : null,
      topic: b.topic ? String(b.topic) : null,
      total: Number(b.total) || 0,
      correct: Number(b.correct) || 0,
    });
    return NextResponse.json({ ok: true, ...res });
  }
  return NextResponse.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
}
