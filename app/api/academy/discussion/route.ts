import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// BLD-529: per-lesson discussion / Q&A for trainees.
//   GET  ?lessonId=…           → { note, comments } (the lesson's note + thread)
//   POST { lessonId, body, parentId? } → add a comment / reply
//   DELETE { commentId }       → remove the learner's own comment

export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });

  const lessonId = new URL(req.url).searchParams.get('lessonId');
  if (!lessonId) return NextResponse.json({ ok: false, error: 'Missing lesson.' }, { status: 400 });

  const { getLessonEngagement } = await import('@/lib/lms');
  const data = await getLessonEngagement(student.id, lessonId);
  return NextResponse.json({ ok: true, ...data });
}

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!body?.lessonId) return NextResponse.json({ ok: false, error: 'Missing lesson.' }, { status: 400 });

  const { addLessonComment } = await import('@/lib/lms');
  const res = await addLessonComment(student.id, String(body.lessonId), String(body.body ?? ''), body.parentId ? String(body.parentId) : null);
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}

export async function DELETE(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!body?.commentId) return NextResponse.json({ ok: false, error: 'Missing comment.' }, { status: 400 });

  const { deleteOwnComment } = await import('@/lib/lms');
  const res = await deleteOwnComment(student.id, String(body.commentId));
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
