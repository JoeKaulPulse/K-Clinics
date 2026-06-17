import 'server-only';
import { db } from '@/lib/db';
import { currentTenantId } from '@/lib/tenant';

// ── Academy gamification ─────────────────────────────────────────────────────
// XP earned across lessons, quizzes and practice; badges for milestones; and
// cohort + all-time leaderboards. Kept separate from the STAFF engine in
// lib/gamification.ts (StaffPoints). XP lives on AcademyStudent.xp and is
// mirrored to a PointEvent ledger so it can be recomputed and shown as activity.

export const XP = { LESSON: 10, QUIZ_PASS: 25, QUIZ_PERFECT_BONUS: 10, PRACTICE_PER_CORRECT: 1 } as const;

export type BadgeDef = { key: string; name: string; description: string; icon: string; bonus: number };

/** Badge catalogue (data only — safe to send to the client for the locked/earned grid). */
export const BADGES: BadgeDef[] = [
  { key: 'first-lesson', name: 'First steps', description: 'Completed your first lesson.', icon: '🌱', bonus: 5 },
  { key: 'bookworm', name: 'Bookworm', description: 'Completed 10 lessons.', icon: '📚', bonus: 20 },
  { key: 'assessed', name: 'Assessed', description: 'Passed your first assessment.', icon: '✅', bonus: 10 },
  { key: 'flawless', name: 'Flawless', description: 'Scored 100% on an assessment.', icon: '🎯', bonus: 25 },
  { key: 'graduate', name: 'Graduate', description: 'Completed a whole course.', icon: '🎓', bonus: 50 },
  { key: 'grafter', name: 'Grafter', description: 'Answered 50 practice questions.', icon: '💪', bonus: 20 },
  { key: 'sharp', name: 'Sharp shooter', description: 'Scored 90%+ on a practice set.', icon: '🔥', bonus: 20 },
];

type Stats = { lessonsDone: number; quizzesPassed: number; perfectQuiz: boolean; coursesComplete: number; practiceQuestions: number; bestPracticePct: number };

async function computeStats(studentId: string): Promise<Stats> {
  const [lessonsDone, passedQuizRows, perfect, practice, courses] = await Promise.all([
    db.lessonProgress.count({ where: { studentId } }),
    db.quizAttempt.findMany({ where: { studentId, passed: true }, select: { quizId: true }, distinct: ['quizId'] }),
    db.quizAttempt.findFirst({ where: { studentId, scorePct: 100 }, select: { id: true } }),
    db.practiceAttempt.aggregate({ where: { studentId }, _sum: { total: true }, _max: { scorePct: true } }),
    db.enrolment.findMany({ where: { studentId, status: { in: ['PAID', 'ENROLLED', 'COMPLETED'] } }, select: { courseId: true } }),
  ]);
  let coursesComplete = 0;
  for (const courseId of [...new Set(courses.map((c) => c.courseId))]) {
    const [lTotal, qTotal, lDone, qPass] = await Promise.all([
      db.lesson.count({ where: { module: { courseId } } }),
      db.quiz.count({ where: { module: { courseId } } }),
      db.lessonProgress.count({ where: { studentId, lesson: { module: { courseId } } } }),
      db.quizAttempt.findMany({ where: { studentId, passed: true, quiz: { module: { courseId } } }, select: { quizId: true }, distinct: ['quizId'] }),
    ]);
    if (lTotal + qTotal > 0 && lDone >= lTotal && qPass.length >= qTotal) coursesComplete++;
  }
  return { lessonsDone, quizzesPassed: passedQuizRows.length, perfectQuiz: Boolean(perfect), coursesComplete, practiceQuestions: practice._sum.total ?? 0, bestPracticePct: practice._max.scorePct ?? 0 };
}

function meetsBadge(key: string, s: Stats): boolean {
  switch (key) {
    case 'first-lesson': return s.lessonsDone >= 1;
    case 'bookworm': return s.lessonsDone >= 10;
    case 'assessed': return s.quizzesPassed >= 1;
    case 'flawless': return s.perfectQuiz;
    case 'graduate': return s.coursesComplete >= 1;
    case 'grafter': return s.practiceQuestions >= 50;
    case 'sharp': return s.bestPracticePct >= 90;
    default: return false;
  }
}

/** Add XP and write a ledger row. Best-effort; never throws into a learning flow. */
export async function awardXp(studentId: string, kind: string, points: number, courseId?: string | null, note?: string): Promise<void> {
  if (!points) return;
  try {
    const tenantId = await currentTenantId();
    await db.$transaction([
      db.academyStudent.update({ where: { id: studentId }, data: { xp: { increment: points } } }),
      db.pointEvent.create({ data: { tenantId, studentId, kind, points, courseId: courseId ?? null, note: note ?? null } }),
    ]);
  } catch { /* gamification must not break the underlying action */ }
}

/** Evaluate badge criteria and award any newly-earned badges (+ their bonus XP). */
export async function checkAndAwardBadges(studentId: string): Promise<string[]> {
  try {
    const [stats, owned] = await Promise.all([
      computeStats(studentId),
      db.studentBadge.findMany({ where: { studentId }, select: { badgeKey: true } }),
    ]);
    const have = new Set(owned.map((b) => b.badgeKey));
    const awarded: string[] = [];
    const tenantId = await currentTenantId();
    for (const b of BADGES) {
      if (have.has(b.key) || !meetsBadge(b.key, stats)) continue;
      try {
        await db.studentBadge.create({ data: { tenantId, studentId, badgeKey: b.key } });
        await awardXp(studentId, 'BADGE', b.bonus, null, b.name);
        awarded.push(b.key);
      } catch { /* unique race — already awarded */ }
    }
    return awarded;
  } catch { return []; }
}

export type AwardedBadge = { key: string; name: string; icon: string };

/** Convenience: award XP for an action then re-check badges. Returns any badges
 *  newly earned (so the client can celebrate them). Never throws. */
export async function scoreAndBadge(studentId: string, kind: string, points: number, courseId?: string | null): Promise<AwardedBadge[]> {
  await awardXp(studentId, kind, points, courseId);
  const keys = await checkAndAwardBadges(studentId);
  const byKey = new Map(BADGES.map((b) => [b.key, b]));
  return keys.map((k) => byKey.get(k)).filter((b): b is BadgeDef => Boolean(b)).map((b) => ({ key: b.key, name: b.name, icon: b.icon }));
}

export type LeaderRow = { rank: number; studentId: string; name: string; xp: number; badges: number; isMe?: boolean };

function displayName(first: string, last: string | null, full: boolean): string {
  if (full) return `${first}${last ? ` ${last}` : ''}`;
  return `${first}${last ? ` ${last[0]}.` : ''}`;
}

async function rankRows(students: { id: string; firstName: string; lastName: string | null; xp: number }[], meId: string | undefined, full: boolean): Promise<LeaderRow[]> {
  const ids = students.map((s) => s.id);
  const badgeCounts = ids.length ? await db.studentBadge.groupBy({ by: ['studentId'], where: { studentId: { in: ids } }, _count: { _all: true } }) : [];
  const byId = new Map(badgeCounts.map((b) => [b.studentId, b._count._all]));
  return students.map((s, i) => ({ rank: i + 1, studentId: s.id, name: displayName(s.firstName, s.lastName, full), xp: s.xp, badges: byId.get(s.id) ?? 0, isMe: s.id === meId }));
}

/** Top of the all-time board (privacy-safe names unless fullNames for admin). */
export async function allTimeLeaderboard(opts: { limit?: number; meId?: string; fullNames?: boolean } = {}): Promise<LeaderRow[]> {
  const students = await db.academyStudent.findMany({ where: { portalActive: true }, orderBy: [{ xp: 'desc' }, { createdAt: 'asc' }], take: opts.limit ?? 20, select: { id: true, firstName: true, lastName: true, xp: true } });
  return rankRows(students, opts.meId, !!opts.fullNames);
}

/** Leaderboard for one cohort (students enrolled in it), ranked by XP. */
export async function cohortLeaderboard(cohortId: string, opts: { meId?: string; fullNames?: boolean } = {}): Promise<LeaderRow[]> {
  const enrols = await db.enrolment.findMany({ where: { cohortId, studentId: { not: null } }, select: { student: { select: { id: true, firstName: true, lastName: true, xp: true } } } });
  const seen = new Map<string, { id: string; firstName: string; lastName: string | null; xp: number }>();
  for (const e of enrols) if (e.student) seen.set(e.student.id, e.student);
  const students = [...seen.values()].sort((a, b) => b.xp - a.xp);
  return rankRows(students, opts.meId, !!opts.fullNames);
}

export type Standing = { xp: number; rank: number; total: number; badges: { key: string; name: string; icon: string; description: string; awardedAt: string }[] };

/** A student's own XP, all-time rank and earned badges. */
export async function studentStanding(studentId: string): Promise<Standing> {
  const me = await db.academyStudent.findUnique({ where: { id: studentId }, select: { xp: true } });
  const xp = me?.xp ?? 0;
  const [ahead, total, owned] = await Promise.all([
    db.academyStudent.count({ where: { portalActive: true, xp: { gt: xp } } }),
    db.academyStudent.count({ where: { portalActive: true } }),
    db.studentBadge.findMany({ where: { studentId }, orderBy: { awardedAt: 'desc' } }),
  ]);
  const byKey = new Map(BADGES.map((b) => [b.key, b]));
  return {
    xp, rank: ahead + 1, total,
    badges: owned.map((b) => { const def = byKey.get(b.badgeKey); return { key: b.badgeKey, name: def?.name ?? b.badgeKey, icon: def?.icon ?? '🏅', description: def?.description ?? '', awardedAt: b.awardedAt.toISOString() }; }),
  };
}

/** The cohort to show a trainee (their most recent enrolment's cohort, if any). */
export async function studentCohortId(studentId: string): Promise<string | null> {
  const e = await db.enrolment.findFirst({ where: { studentId, cohortId: { not: null } }, orderBy: { createdAt: 'desc' }, select: { cohortId: true } });
  return e?.cohortId ?? null;
}

/** Recompute a student's XP from their history (used by the backfill). */
async function recomputeStudentXp(studentId: string): Promise<void> {
  const [lessons, passedQuizzes, practices] = await Promise.all([
    db.lessonProgress.count({ where: { studentId } }),
    db.quizAttempt.findMany({ where: { studentId, passed: true }, select: { quizId: true, scorePct: true }, distinct: ['quizId'] }),
    db.practiceAttempt.findMany({ where: { studentId }, select: { correct: true } }),
  ]);
  let xp = lessons * XP.LESSON;
  for (const q of passedQuizzes) xp += XP.QUIZ_PASS + (q.scorePct === 100 ? XP.QUIZ_PERFECT_BONUS : 0);
  for (const p of practices) xp += p.correct * XP.PRACTICE_PER_CORRECT;
  await db.academyStudent.update({ where: { id: studentId }, data: { xp } });
}

const BACKFILL_KEY = 'academy_gamification_backfilled';

/** Self-healing: compute XP + badges for everyone once, so leaderboards are real
 *  from launch. Flag-gated; subsequent activity is scored live. */
export async function backfillGamificationIfNeeded(): Promise<{ ran: boolean; students: number }> {
  const done = await db.setting.findUnique({ where: { key: BACKFILL_KEY } }).catch(() => null);
  if (done?.value === 'true') return { ran: false, students: 0 };
  const students = await db.academyStudent.findMany({ select: { id: true } });
  for (const s of students) {
    await recomputeStudentXp(s.id).catch(() => {});
    await checkAndAwardBadges(s.id).catch(() => {}); // adds badge bonus XP on top of the recomputed base
  }
  await db.setting.upsert({ where: { key: BACKFILL_KEY }, update: { value: 'true' }, create: { key: BACKFILL_KEY, value: 'true' } }).catch(() => {});
  return { ran: true, students: students.length };
}
