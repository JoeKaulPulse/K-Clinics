import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// BLD-445: record that the signed-in academy student has read + acknowledged the
// mandatory pre-course information page for a course. Until preCourseAckAt is set
// on their enrolment, the learn page shows the gate instead of the lessons.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) return NextResponse.json({ ok: false, error: 'Please sign in again.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const slug = String(body.slug || '').trim();
  if (!slug) return NextResponse.json({ ok: false, error: 'Missing course.' }, { status: 400 });

  const { db } = await import('@/lib/db');
  const course = await db.course.findFirst({ where: { slug }, select: { id: true } });
  if (!course) return NextResponse.json({ ok: false, error: 'Course not found.' }, { status: 404 });

  await db.enrolment.updateMany({
    where: { studentId: student.id, courseId: course.id, status: { in: ['PAID', 'ENROLLED', 'COMPLETED'] }, preCourseAckAt: null },
    data: { preCourseAckAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
