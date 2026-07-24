import 'server-only';
import { db } from './db';
import { sendEmail, tmplLiveClassScheduled, tmplLiveClassRescheduled, tmplLiveClassCancelled, tmplLiveClassReminder } from './email';

export type LiveClassNotice = {
  id: string;
  courseId: string;
  title: string;
  startAt: Date;
  joinUrl?: string | null;
  trainer?: string | null;
};

// BLD-1034: LiveClassManager (admin) let staff create, reschedule or delete a
// scheduled live class with zero signal reaching enrolled students. This
// notifies every ENROLLED enrolment on the class's course by email — reusing
// the applicantName/applicantEmail captured on Enrolment (present whether or
// not the learner has a linked AcademyStudent account, so this reaches every
// enrolled student unconditionally).
//
// Best-effort and non-blocking, mirroring the try/catch + .catch(() => {})
// pattern used throughout lib/booking-actions.ts / lib/automations.ts: a send
// failure for one student (or the whole notify pass) never blocks or reverts
// the admin action that triggered it.
export async function notifyLiveClassChange(
  liveClass: LiveClassNotice,
  change: 'created' | 'rescheduled' | 'cancelled',
  opts: { oldStartAt?: Date } = {},
): Promise<void> {
  try {
    const course = await db.course.findUnique({ where: { id: liveClass.courseId }, select: { title: true } });
    const courseTitle = course?.title || 'your course';
    const enrolments = await db.enrolment.findMany({
      // Course access — not just cohort-confirmed. A self-serve Stripe payment
      // lands the learner in PAID (applyPaidPayment never sets ENROLLED, and
      // nothing auto-promotes PAID→ENROLLED), and the whole LMS treats
      // PAID/ENROLLED as "has access" (lib/lms.ts, flashcards, portfolio…), so
      // filtering to ENROLLED only would miss every paying student. (BLD-1034)
      where: { courseId: liveClass.courseId, status: { in: ['PAID', 'ENROLLED'] } },
      select: { applicantName: true, applicantEmail: true },
    });
    for (const e of enrolments) {
      if (!e.applicantEmail) continue;
      const firstName = (e.applicantName || 'there').trim().split(/\s+/)[0] || 'there';
      const subject = change === 'created'
        ? `New live session: ${liveClass.title}`
        : change === 'rescheduled'
        ? `Live session rescheduled: ${liveClass.title}`
        : `Live session cancelled: ${liveClass.title}`;
      const html = change === 'created'
        ? tmplLiveClassScheduled({ firstName, courseTitle, classTitle: liveClass.title, start: liveClass.startAt, joinUrl: liveClass.joinUrl, trainer: liveClass.trainer })
        : change === 'rescheduled'
        ? tmplLiveClassRescheduled({ firstName, courseTitle, classTitle: liveClass.title, oldStart: opts.oldStartAt || liveClass.startAt, newStart: liveClass.startAt, joinUrl: liveClass.joinUrl, trainer: liveClass.trainer })
        : tmplLiveClassCancelled({ firstName, courseTitle, classTitle: liveClass.title, start: liveClass.startAt });
      const res = await sendEmail({ to: e.applicantEmail, subject, html });
      await db.emailEvent.create({ data: { kind: 'LIVE_CLASS', to: e.applicantEmail, subject, status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error, meta: { liveClassId: liveClass.id, change } } }).catch(() => {});
      if (!res.ok) console.error('[academy-live-class] notify send failed:', res.error);
    }
  } catch (e) {
    // Never let a notify failure block or roll back the admin's create/reschedule/delete.
    console.error('[academy-live-class] notify failed:', (e as Error)?.message);
  }
}

// BLD-1034: same-day reminder for upcoming live classes, mirroring the shape of
// the booking reminder windows in lib/automations.ts (reminders()). Idempotency
// follows the EmailEvent-lookup pattern used by the other multi-recipient
// automations in that file (tierNudges, membershipRenewal, aftercare, ...)
// rather than a new per-class boolean flag, since one class can have many
// recipients and the dedup key is naturally (liveClassId, recipient email).
export async function sendLiveClassSameDayReminders(): Promise<{ sent: number; errors: number }> {
  const tally = { sent: 0, errors: 0 };
  try {
    const { clinicDateISO, clinicDayBounds } = await import('@/lib/clinic-time');
    const todayISO = clinicDateISO(new Date());
    const { dayStart: start, dayEnd: end } = clinicDayBounds(todayISO);
    const classes = await db.liveClass.findMany({
      where: { startAt: { gte: start, lte: end } },
      include: { course: { select: { title: true } } },
    });
    for (const lc of classes) {
      const courseTitle = lc.course?.title || 'your course';
      const enrolments = await db.enrolment.findMany({
        where: { courseId: lc.courseId, status: { in: ['PAID', 'ENROLLED'] } },
        select: { applicantName: true, applicantEmail: true },
      });
      for (const e of enrolments) {
        if (!e.applicantEmail) continue;
        const dup = await db.emailEvent.findFirst({
          where: {
            kind: 'LIVE_CLASS',
            to: e.applicantEmail,
            AND: [{ meta: { path: ['liveClassId'], equals: lc.id } }, { meta: { path: ['change'], equals: 'reminder' } }],
          },
        });
        if (dup) continue;
        const firstName = (e.applicantName || 'there').trim().split(/\s+/)[0] || 'there';
        const subject = `Today: ${lc.title}`;
        const html = tmplLiveClassReminder({ firstName, courseTitle, classTitle: lc.title, start: lc.startAt, joinUrl: lc.joinUrl, trainer: lc.trainer });
        const res = await sendEmail({ to: e.applicantEmail, subject, html });
        await db.emailEvent.create({ data: { kind: 'LIVE_CLASS', to: e.applicantEmail, subject, status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error, meta: { liveClassId: lc.id, change: 'reminder' } } }).catch(() => {});
        res.ok ? tally.sent++ : tally.errors++;
      }
    }
  } catch (e) {
    tally.errors++;
    console.error('[academy-live-class] same-day reminders failed:', (e as Error)?.message);
  }
  return tally;
}
