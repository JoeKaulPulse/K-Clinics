import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// BLD-535: grade an interactive exercise submission (server-side).
//   POST { op:'grade', exerciseId, answer }
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (b.op !== 'grade' || !b.exerciseId) return NextResponse.json({ ok: false, error: 'Bad request.' }, { status: 400 });
  const { gradeExercise } = await import('@/lib/exercises');
  const res = await gradeExercise(student.id, String(b.exerciseId), b.answer);
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
