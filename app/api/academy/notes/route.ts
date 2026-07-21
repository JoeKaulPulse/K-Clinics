import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// BLD-529: save (or clear) a trainee's private note for a lesson.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!body?.lessonId) return NextResponse.json({ ok: false, error: 'Missing lesson.' }, { status: 400 });

  const { saveLessonNote } = await import('@/lib/lms');
  const res = await saveLessonNote(student.id, String(body.lessonId), String(body.body ?? ''));
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
