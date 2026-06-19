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

  // An answer is either selected option indices (choice) or a typed string (SHORT).
  const cleanAnswer = (v: unknown): number[] | string =>
    typeof v === 'string' ? v.slice(0, 2000) : Array.isArray(v) ? [...new Set((v as unknown[]).map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 0 && n < 100))] : [];

  // Per-question check for immediate, Duolingo-style feedback (records nothing).
  if (body.mode === 'check') {
    const questionId = String(body.questionId || '');
    if (!questionId) return NextResponse.json({ ok: false, error: 'Missing question.' }, { status: 400 });
    const { checkQuizAnswer } = await import('@/lib/lms');
    const res = await checkQuizAnswer(student.id, quizId, questionId, cleanAnswer(body.answer));
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  }

  // Full submit — records the attempt and returns the score.
  const raw = (body.answers && typeof body.answers === 'object' ? body.answers : {}) as Record<string, unknown>;
  const answers: Record<string, number[] | string> = {};
  for (const [k, v] of Object.entries(raw)) answers[k] = cleanAnswer(v);
  const { gradeQuiz } = await import('@/lib/lms');
  const res = await gradeQuiz(student.id, quizId, answers);
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
