import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Mark a lesson complete for the signed-in trainee.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });

  const { lessonId } = await req.json().catch(() => ({}));
  if (!lessonId) return NextResponse.json({ ok: false, error: 'Missing lesson.' }, { status: 400 });

  const { completeLesson } = await import('@/lib/lms');
  const res = await completeLesson(student.id, String(lessonId));
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
