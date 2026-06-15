import 'server-only';
import { db } from './db';

// PRJ-63 — staff time-tracking service. Shifts and breaks are open/closed
// intervals (TimeEntry). Net worked = shift time − break time. All operations are
// self-healing about dangling open intervals (e.g. forgot to clock out) so the
// desk never gets stuck: clocking out closes any open break too; you can't open a
// break without an open shift; opening a second shift first closes the old one.

const MS_MIN = 60_000;
const minutesBetween = (a: Date, b: Date) => Math.max(0, Math.round((b.getTime() - a.getTime()) / MS_MIN));

export type TimeStatus = {
  onShift: boolean;
  onBreak: boolean;
  /** Start of the current shift, if on shift. */
  shiftStart: Date | null;
  /** Start of the current break, if on break. */
  breakStart: Date | null;
  /** Net minutes worked today (shift − breaks), including any open interval up to now. */
  workedTodayMin: number;
  /** Minutes on break today. */
  breakTodayMin: number;
};

function openOf<T extends { kind: string; endedAt: Date | null }>(entries: T[], kind: string): T | null {
  return entries.find((e) => e.kind === kind && e.endedAt === null) ?? null;
}

/** Clock in — opens a SHIFT (closing any already-open shift first; no-op if already on shift returns the open one). */
export async function clockIn(userId: string): Promise<{ ok: boolean; alreadyOn?: boolean }> {
  const open = await db.timeEntry.findFirst({ where: { userId, kind: 'SHIFT', endedAt: null } });
  if (open) return { ok: true, alreadyOn: true };
  await db.timeEntry.create({ data: { userId, kind: 'SHIFT' } });
  return { ok: true };
}

/** Clock out — closes the open shift and any open break. */
export async function clockOut(userId: string): Promise<{ ok: boolean }> {
  const now = new Date();
  await db.timeEntry.updateMany({ where: { userId, endedAt: null }, data: { endedAt: now } });
  return { ok: true };
}

/** Start a break (e.g. lunch). Requires an open shift; closes any existing open break first. */
export async function startBreak(userId: string, note?: string): Promise<{ ok: boolean; error?: string }> {
  const shift = await db.timeEntry.findFirst({ where: { userId, kind: 'SHIFT', endedAt: null } });
  if (!shift) return { ok: false, error: 'Clock in before taking a break.' };
  const openBreak = await db.timeEntry.findFirst({ where: { userId, kind: 'BREAK', endedAt: null } });
  if (openBreak) return { ok: true };
  await db.timeEntry.create({ data: { userId, kind: 'BREAK', note: note?.trim() || null } });
  return { ok: true };
}

/** End the current break. */
export async function endBreak(userId: string): Promise<{ ok: boolean }> {
  await db.timeEntry.updateMany({ where: { userId, kind: 'BREAK', endedAt: null }, data: { endedAt: new Date() } });
  return { ok: true };
}

/** Current clock status + today's worked/break totals. */
export async function timeStatus(userId: string, now = new Date()): Promise<TimeStatus> {
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
  // Entries overlapping today (started today, or still open from earlier).
  const entries = await db.timeEntry.findMany({
    where: { userId, OR: [{ startedAt: { gte: dayStart } }, { endedAt: null }] },
    select: { kind: true, startedAt: true, endedAt: true },
  }).catch(() => []);

  const shift = openOf(entries, 'SHIFT');
  const brk = openOf(entries, 'BREAK');

  // Clamp each interval to [dayStart, now] so totals are "today" only.
  const clampedMin = (s: Date, e: Date | null) => {
    const start = s < dayStart ? dayStart : s;
    const end = e ?? now;
    return minutesBetween(start, end > now ? now : end);
  };
  let shiftMin = 0; let breakMin = 0;
  for (const e of entries) {
    const m = clampedMin(e.startedAt, e.endedAt);
    if (e.kind === 'SHIFT') shiftMin += m; else breakMin += m;
  }
  return {
    onShift: !!shift,
    onBreak: !!brk,
    shiftStart: shift?.startedAt ?? null,
    breakStart: brk?.startedAt ?? null,
    workedTodayMin: Math.max(0, shiftMin - breakMin),
    breakTodayMin: breakMin,
  };
}

export type TimesheetDay = { date: string; workedMin: number; breakMin: number };

/** Per-day net worked + break minutes over a range (inclusive), for a timesheet. */
export async function timesheet(userId: string, from: Date, to: Date): Promise<{ days: TimesheetDay[]; totalWorkedMin: number }> {
  const now = new Date();
  const entries = await db.timeEntry.findMany({
    where: { userId, startedAt: { lte: to }, OR: [{ endedAt: { gte: from } }, { endedAt: null }] },
    select: { kind: true, startedAt: true, endedAt: true },
    orderBy: { startedAt: 'asc' },
  }).catch(() => []);

  const byDay = new Map<string, { worked: number; brk: number }>();
  for (const e of entries) {
    const start = e.startedAt;
    const end = e.endedAt ?? now;
    const key = start.toLocaleDateString('en-CA', { timeZone: 'Europe/London' }); // YYYY-MM-DD, clinic day
    const m = minutesBetween(start, end);
    const cur = byDay.get(key) ?? { worked: 0, brk: 0 };
    if (e.kind === 'SHIFT') cur.worked += m; else cur.brk += m;
    byDay.set(key, cur);
  }
  const days: TimesheetDay[] = [...byDay.entries()]
    .map(([date, v]) => ({ date, workedMin: Math.max(0, v.worked - v.brk), breakMin: v.brk }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const totalWorkedMin = days.reduce((s, d) => s + d.workedMin, 0);
  return { days, totalWorkedMin };
}

/** "7h 32m" from minutes. */
export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60); const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
