import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// BLD-539: grade a "spot the mistake" attempt.
//   POST { op:'grade', videoId, presses: number[] }  (presses = seconds)
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (b.op !== 'grade' || !b.videoId) return NextResponse.json({ ok: false, error: 'Bad request.' }, { status: 400 });
  const { gradeDemo } = await import('@/lib/demos');
  const res = await gradeDemo(student.id, String(b.videoId), b.presses);
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
