import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// BLD-446: a learner submits (or resubmits) homework for a lesson. One logical
// submission per student+lesson; resubmitting resets it to SUBMITTED.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) return NextResponse.json({ ok: false, error: 'Please sign in again.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const lessonId = String(body.lessonId || '').trim();
  const files = Array.isArray(body.files) ? (body.files as unknown[]).map((x) => String(x)).filter((u) => /^https?:\/\//.test(u)).slice(0, 10) : [];
  const note = typeof body.note === 'string' ? body.note.slice(0, 2000) || null : null;
  if (!lessonId) return NextResponse.json({ ok: false, error: 'Missing lesson.' }, { status: 400 });
  if (files.length === 0) return NextResponse.json({ ok: false, error: 'Attach at least one file.' }, { status: 400 });

  const { db } = await import('@/lib/db');
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { requiresHomework: true, module: { select: { courseId: true } } } });
  if (!lesson) return NextResponse.json({ ok: false, error: 'Lesson not found.' }, { status: 404 });
  if (!lesson.requiresHomework) return NextResponse.json({ ok: false, error: 'This lesson doesn’t take homework.' }, { status: 400 });
  const { studentCanAccess } = await import('@/lib/lms');
  if (!(await studentCanAccess(student.id, lesson.module.courseId))) return NextResponse.json({ ok: false, error: 'Not enrolled.' }, { status: 403 });

  const existing = await db.homeworkSubmission.findFirst({ where: { studentId: student.id, lessonId }, select: { id: true } });
  if (existing) {
    await db.homeworkSubmission.update({ where: { id: existing.id }, data: { files, note, status: 'SUBMITTED', feedback: null, reviewedBy: null, reviewedAt: null } });
  } else {
    await db.homeworkSubmission.create({ data: { studentId: student.id, lessonId, files, note } });
  }

  try {
    const { notifyStaffByPermission } = await import('@/lib/notifications');
    await notifyStaffByPermission('settings.manage', { kind: 'status', category: 'system', priority: 'normal', title: 'Homework submitted', body: `${student.firstName || 'A learner'} submitted homework for review`, href: '/admin/academy/homework' });
  } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true });
}
