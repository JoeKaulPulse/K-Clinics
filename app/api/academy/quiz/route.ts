import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Grade a quiz submission for the signed-in trainee. Correct answers stay
// server-side; we return per-question correctness + explanations.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const quizId = String(body.quizId || '');
  if (!quizId) return NextResponse.json({ ok: false, error: 'Missing quiz.' }, { status: 400 });

  // Per-question check for immediate, Duolingo-style feedback (records nothing).
  if (body.mode === 'check') {
    const questionId = String(body.questionId || '');
    const answer = Array.isArray(body.answer) ? (body.answer as unknown[]).map((n) => Number(n)).filter((n) => Number.isInteger(n)) : [];
    if (!questionId) return NextResponse.json({ ok: false, error: 'Missing question.' }, { status: 400 });
    const { checkQuizAnswer } = await import('@/lib/lms');
    const res = await checkQuizAnswer(student.id, quizId, questionId, answer);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  }

  // Full submit — records the attempt and returns the score.
  const answers = (body.answers && typeof body.answers === 'object' ? body.answers : {}) as Record<string, number[]>;
  const { gradeQuiz } = await import('@/lib/lms');
  const res = await gradeQuiz(student.id, quizId, answers);
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
