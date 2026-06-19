import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Mark a lesson complete for the signed-in trainee.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const lessonId = body?.lessonId;
  if (!lessonId) return NextResponse.json({ ok: false, error: 'Missing lesson.' }, { status: 400 });

  // BLD-529: a body carrying `positionSec` is a lightweight resume-position save
  // (video/audio scrub), never a completion. Completion still sends `secondsSpent`.
  if (Object.prototype.hasOwnProperty.call(body, 'positionSec')) {
    const { saveVideoPosition } = await import('@/lib/lms');
    const res = await saveVideoPosition(student.id, String(lessonId), Number(body.positionSec) || 0);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  }

  const { completeLesson } = await import('@/lib/lms');
  const res = await completeLesson(student.id, String(lessonId), Number(body.secondsSpent) || 0);
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
