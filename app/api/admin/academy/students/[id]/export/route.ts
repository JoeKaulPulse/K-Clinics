import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// BLD-1311: Subject Access Request export for an academy trainee (Art. 15 UK
// GDPR) — the academy-side equivalent of /api/admin/clients/[id]/export.
// Mirrors the data surface eraseStudentData (app/admin/actions.ts) erases:
// progress + activity, quiz/homework submissions, forum/lesson posts, funding
// applications, and goals. Gated on settings.manage — the same permission
// eraseStudentData and the academy admin endpoints require.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { id } = await params;
  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!session || !sessionCan(session, 'settings.manage')) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  // Match the client SAR export's rate limit (BLD-1134) — without one a
  // compromised staff session could script-loop student IDs and bulk-exfiltrate
  // trainee records.
  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'admin-academy-sar-export', 30, 3600, 'admin'))) {
    return NextResponse.json({ ok: false, error: 'Too many exports. Please try again later.' }, { status: 429 });
  }

  const { db } = await import('@/lib/db');
  const student = await db.academyStudent.findUnique({ where: { id } });
  if (!student) return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });

  // Strip auth secrets from the dump — same treatment the client export gives passwordHash.
  const { passwordHash, resetTokenHash, resetTokenExp, ...studentOut } = student as Record<string, unknown> & {
    passwordHash?: unknown; resetTokenHash?: unknown; resetTokenExp?: unknown;
  };
  void passwordHash; void resetTokenHash; void resetTokenExp;

  const [
    enrolments, fundingApplications, lessonProgress, lessonPlaybacks, lessonNotes,
    lessonComments, courseReviews, flashcardReviews, forumThreads, forumPosts,
    portfolioEntries, exerciseAttempts, demoAttempts, quizAttempts, quizAttemptGrants,
    practiceAttempts, pointEvents, badges, dailyActivity, homeworkSubmissions,
  ] = await Promise.all([
    db.enrolment.findMany({ where: { studentId: id }, orderBy: { createdAt: 'desc' } }),
    // Matched by the FK (post-account enquiries) and, exactly as eraseStudentData
    // redacts them, by the original email (enquiries made before the account
    // existed, which still have no studentId) — otherwise the export omits
    // records the erasure treats as this subject's own.
    db.fundingApplication.findMany({
      where: { OR: [{ studentId: id }, { studentId: null, email: { equals: student.email, mode: 'insensitive' } }] },
      orderBy: { createdAt: 'desc' },
    }),
    db.lessonProgress.findMany({ where: { studentId: id }, orderBy: { completedAt: 'desc' } }),
    db.lessonPlayback.findMany({ where: { studentId: id } }),
    db.lessonNote.findMany({ where: { studentId: id }, orderBy: { createdAt: 'desc' } }),
    db.lessonComment.findMany({ where: { authorStudentId: id }, orderBy: { createdAt: 'desc' } }),
    db.courseReview.findMany({ where: { studentId: id }, orderBy: { createdAt: 'desc' } }),
    db.flashcardReview.findMany({ where: { studentId: id } }),
    db.forumThread.findMany({ where: { authorStudentId: id }, orderBy: { createdAt: 'desc' } }),
    db.forumPost.findMany({ where: { authorStudentId: id }, orderBy: { createdAt: 'desc' } }),
    db.portfolioEntry.findMany({ where: { studentId: id }, orderBy: { createdAt: 'desc' } }),
    db.exerciseAttempt.findMany({ where: { studentId: id }, orderBy: { completedAt: 'desc' } }),
    db.demoAttempt.findMany({ where: { studentId: id }, orderBy: { completedAt: 'desc' } }),
    db.quizAttempt.findMany({ where: { studentId: id }, orderBy: { createdAt: 'desc' } }),
    db.quizAttemptGrant.findMany({ where: { studentId: id }, orderBy: { createdAt: 'desc' } }),
    db.practiceAttempt.findMany({ where: { studentId: id }, orderBy: { createdAt: 'desc' } }),
    db.pointEvent.findMany({ where: { studentId: id }, orderBy: { createdAt: 'desc' } }),
    db.studentBadge.findMany({ where: { studentId: id }, orderBy: { awardedAt: 'desc' } }),
    db.dailyActivity.findMany({ where: { studentId: id }, orderBy: { day: 'desc' } }),
    db.homeworkSubmission.findMany({ where: { studentId: id }, orderBy: { createdAt: 'desc' } }),
  ]);

  const out = {
    exportedAt: new Date().toISOString(),
    exportedBy: session.email,
    student: studentOut,
    enrolments,
    fundingApplications,
    lessonProgress,
    lessonPlaybacks,
    lessonNotes,
    lessonComments,
    courseReviews,
    flashcardReviews,
    forumThreads,
    forumPosts,
    portfolioEntries,
    exerciseAttempts,
    demoAttempts,
    quizAttempts,
    quizAttemptGrants,
    practiceAttempts,
    pointEvents,
    badges,
    dailyActivity,
    homeworkSubmissions,
  };

  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'DATA_EXPORTED', actor: session.email, actorRole: session.role, summary: `Academy student ${student.email} data exported (SAR — Art. 15 UK GDPR)`, meta: { studentId: id } });

  const name = [student.firstName, student.lastName].filter(Boolean).join('-').toLowerCase() || 'student';
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="kclinics-academy-${name}-${id}.json"`,
    },
  });
}
