import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// BLD-445: record that the signed-in academy student has read + acknowledged the
// mandatory pre-course information page for a course. Until preCourseAckAt is set
// on their enrolment, the learn page shows the gate instead of the lessons.
// BLD-730: the same submission signs the Learner (Training) Agreement — typed
// full name, timestamp and wording version stored on the enrolment as the
// demonstrable signature record.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) return NextResponse.json({ ok: false, error: 'Please sign in again.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const slug = String(body.slug || '').trim();
  if (!slug) return NextResponse.json({ ok: false, error: 'Missing course.' }, { status: 400 });
  const agreementName = String(body.agreementName || '').trim().slice(0, 120);
  if (agreementName.length < 2) return NextResponse.json({ ok: false, error: 'Please sign by typing your full name.' }, { status: 422 });

  const { db } = await import('@/lib/db');
  const { LEARNER_AGREEMENT_VERSION } = await import('@/lib/learner-agreement');
  const course = await db.course.findFirst({ where: { slug }, select: { id: true } });
  if (!course) return NextResponse.json({ ok: false, error: 'Course not found.' }, { status: 404 });

  const now = new Date();
  await db.enrolment.updateMany({
    where: { studentId: student.id, courseId: course.id, status: { in: ['PAID', 'ENROLLED', 'COMPLETED'] }, preCourseAckAt: null },
    data: { preCourseAckAt: now, agreementSignedAt: now, agreementSignedName: agreementName, agreementVersion: LEARNER_AGREEMENT_VERSION },
  });
  return NextResponse.json({ ok: true });
}
