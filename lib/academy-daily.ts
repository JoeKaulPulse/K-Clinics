import 'server-only';
import { db } from '@/lib/db';
import { currentTenantId } from '@/lib/tenant';

// Daily tasks + the "beauty box" — a Duolingo-style chest a trainee unlocks by
// completing a few tasks in a day, opens for a bonus, and that drives a streak.

const GOAL = 3;      // tasks to unlock the box
const BOX_XP = 30;   // bonus XP for opening it

const dayStr = (d = new Date()): string => d.toISOString().slice(0, 10);

/** Count a meaningful task (a completed lesson, passed quiz, or practice set). */
export async function recordDailyTask(studentId: string): Promise<void> {
  try {
    const tenantId = await currentTenantId();
    await db.dailyActivity.upsert({
      where: { studentId_day: { studentId, day: dayStr() } },
      update: { tasks: { increment: 1 } },
      create: { tenantId, studentId, day: dayStr(), tasks: 1 },
    });
  } catch { /* best-effort — never breaks the underlying action */ }
}

export type DailyStatus = { tasks: number; goal: number; boxReady: boolean; boxOpened: boolean; streak: number };

async function computeStreak(studentId: string): Promise<number> {
  const rows = await db.dailyActivity.findMany({ where: { studentId, tasks: { gt: 0 } }, select: { day: true }, orderBy: { day: 'desc' }, take: 400 });
  const days = new Set(rows.map((r) => r.day));
  let streak = 0;
  const d = new Date();
  // Today not yet counting shouldn't break a streak — start from yesterday then.
  if (!days.has(dayStr(d))) d.setUTCDate(d.getUTCDate() - 1);
  while (days.has(dayStr(d))) { streak++; d.setUTCDate(d.getUTCDate() - 1); }
  return streak;
}

export async function dailyStatus(studentId: string): Promise<DailyStatus> {
  const [today, streak] = await Promise.all([
    db.dailyActivity.findUnique({ where: { studentId_day: { studentId, day: dayStr() } } }),
    computeStreak(studentId),
  ]);
  const tasks = today?.tasks ?? 0;
  const boxOpened = today?.boxOpened ?? false;
  return { tasks, goal: GOAL, boxReady: tasks >= GOAL && !boxOpened, boxOpened, streak };
}

/** Open today's box if earned. Awards bonus XP. Idempotent per day (guards a
 *  double-claim with a conditional update). */
export async function openDailyBox(studentId: string): Promise<{ ok: boolean; xp?: number; error?: string }> {
  const day = dayStr();
  const today = await db.dailyActivity.findUnique({ where: { studentId_day: { studentId, day } } });
  if (!today || today.tasks < GOAL) return { ok: false, error: 'Not enough tasks yet today.' };
  if (today.boxOpened) return { ok: false, error: 'Already opened today.' };
  const res = await db.dailyActivity.updateMany({ where: { studentId, day, boxOpened: false }, data: { boxOpened: true } });
  if (res.count === 0) return { ok: false, error: 'Already opened today.' };
  const { awardXp } = await import('@/lib/academy-gamification');
  await awardXp(studentId, 'BONUS', BOX_XP, null, 'Daily beauty box');
  return { ok: true, xp: BOX_XP };
}
