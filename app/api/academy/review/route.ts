import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// BLD-529: a trainee leaves / updates a course review (star rating + text).
// Submitted reviews are PENDING until staff publish them.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!body?.courseId) return NextResponse.json({ ok: false, error: 'Missing course.' }, { status: 400 });

  const { saveCourseReview } = await import('@/lib/lms');
  const res = await saveCourseReview(student.id, String(body.courseId), Number(body.rating) || 0, String(body.title ?? ''), String(body.body ?? ''));
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
