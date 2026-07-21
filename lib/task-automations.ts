import 'server-only';
import { db } from '@/lib/db';

// ─────────────────────────────────────────────────────────────────────────────
// Task automations engine — materialises recurring ("repeat events") and
// trigger-based work onto the team Tasks board (TSK-).
//
// Recurrence is computed in clinic-local time (Europe/London) so "every Monday
// at 09:00" stays at 09:00 across DST. The engine is driven by the dispatch
// cron (every 15 min) and the daily cron; idempotency is guaranteed by a unique
// (automationId, occurrenceKey) run row, so overlapping ticks never double-spawn.
// ─────────────────────────────────────────────────────────────────────────────

const TZ = 'Europe/London';
const LOOKBACK_MS = 36 * 60 * 60 * 1000; // catch up to 36h of missed occurrences
const MAX_PER_RUN = 6; // safety cap per automation per tick

export const FREQS = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;
export const ASSIGN_MODES = ['FIXED', 'ROUND_ROBIN', 'ALL'] as const;
export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type LondonParts = { y: number; m: number; d: number; hh: number; mm: number };

/** Minutes London is ahead of UTC at `date` (60 in summer, 0 in winter). */
function londonOffsetMinutes(date: Date): number {
  const dtf = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) map[p.type] = p.value;
  const asUTC = Date.UTC(+map.year, +map.month - 1, +map.day, +map.hour, +map.minute, +map.second);
  return Math.round((asUTC - date.getTime()) / 60000);
}

/** The UTC instant for a London wall-clock time (y-m-d hh:mm, 1-based month). */
function londonInstant(y: number, m: number, d: number, hh: number, mm: number): Date {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const offset = londonOffsetMinutes(new Date(guess));
  return new Date(guess - offset * 60000);
}

/** London calendar parts for a UTC instant. */
function londonPartsOf(date: Date): LondonParts {
  const dtf = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) map[p.type] = p.value;
  return { y: +map.year, m: +map.month, d: +map.day, hh: +map.hour, mm: +map.minute };
}

/** Weekday (0=Sun…6=Sat) for a calendar date — tz-independent. */
function weekdayOf(y: number, m: number, d: number): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
function daysBetween(a: { y: number; m: number; d: number }, b: { y: number; m: number; d: number }): number {
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
}
function parseHHmm(s: string): { hh: number; mm: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec((s || '').trim());
  const hh = m ? Math.min(23, Math.max(0, +m[1])) : 9;
  const mm = m ? Math.min(59, Math.max(0, +m[2])) : 0;
  return { hh, mm };
}

type Sched = {
  freq: string; interval: number; daysOfWeek: number[]; dayOfMonth: number | null; timeOfDay: string;
  startsOn: Date | null; endsOn: Date | null; createdAt: Date;
};

/** Does this automation fire on the given London calendar date? */
function firesOnDate(a: Sched, y: number, m: number, d: number): boolean {
  const interval = Math.max(1, a.interval || 1);
  const anchor = londonPartsOf(a.startsOn || a.createdAt);
  if (a.freq === 'DAILY') {
    if (interval === 1) return true;
    const n = daysBetween(anchor, { y, m, d });
    return n >= 0 && n % interval === 0;
  }
  if (a.freq === 'WEEKLY') {
    const dow = weekdayOf(y, m, d);
    if (!(a.daysOfWeek || []).includes(dow)) return false;
    if (interval === 1) return true;
    // Whole weeks since the anchor's week (Mon-based), every N weeks.
    const weeks = Math.floor(daysBetween(anchor, { y, m, d }) / 7);
    return weeks >= 0 && weeks % interval === 0;
  }
  if (a.freq === 'MONTHLY') {
    const target = Math.min(28, Math.max(1, a.dayOfMonth || 1));
    if (d !== target) return false;
    if (interval === 1) return true;
    const months = (y - anchor.y) * 12 + (m - anchor.m);
    return months >= 0 && months % interval === 0;
  }
  return false;
}

/** Occurrence instants (UTC) in the half-open window (from, to]. */
function occurrencesInWindow(a: Sched, from: Date, to: Date): Date[] {
  const { hh, mm } = parseHHmm(a.timeOfDay);
  const out: Date[] = [];
  // Walk London calendar dates spanning the window (+1 day each side for tz slack).
  const start = londonPartsOf(new Date(from.getTime() - 86400000));
  const end = londonPartsOf(new Date(to.getTime() + 86400000));
  let cursor = new Date(Date.UTC(start.y, start.m - 1, start.d));
  const endUTC = Date.UTC(end.y, end.m - 1, end.d);
  let guard = 0;
  while (cursor.getTime() <= endUTC && guard++ < 800) {
    const y = cursor.getUTCFullYear(), m = cursor.getUTCMonth() + 1, d = cursor.getUTCDate();
    if (firesOnDate(a, y, m, d)) {
      const inst = londonInstant(y, m, d, hh, mm);
      if (inst > from && inst <= to && (!a.startsOn || inst >= a.startsOn) && (!a.endsOn || inst <= a.endsOn)) out.push(inst);
    }
    cursor = new Date(cursor.getTime() + 86400000);
  }
  return out;
}

/** Next occurrence strictly after `from` (within a year), or null. */
export function nextOccurrence(a: Sched, from: Date = new Date()): Date | null {
  const horizon = new Date(from.getTime() + 366 * 86400000);
  const occ = occurrencesInWindow(a, from, horizon);
  return occ.length ? occ[0] : null;
}

/** A human sentence describing the schedule, for the manager UI. */
export function summarizeSchedule(a: Sched): string {
  const { hh, mm } = parseHHmm(a.timeOfDay);
  const time = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  const every = a.interval > 1 ? `every ${a.interval} ` : '';
  if (a.freq === 'DAILY') return a.interval > 1 ? `Every ${a.interval} days at ${time}` : `Every day at ${time}`;
  if (a.freq === 'WEEKLY') {
    const days = (a.daysOfWeek || []).slice().sort((x, y) => x - y).map((d) => WEEKDAY_LABELS[d]).join(', ') || 'no days set';
    return `${every ? `Every ${a.interval} weeks` : 'Every week'} on ${days} at ${time}`;
  }
  if (a.freq === 'MONTHLY') return `${every ? `Every ${a.interval} months` : 'Every month'} on day ${Math.min(28, Math.max(1, a.dayOfMonth || 1))} at ${time}`;
  return 'Custom schedule';
}

function applyTokens(template: string, inst: Date): string {
  const p = londonPartsOf(inst);
  const dateStr = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(inst);
  const weekday = WEEKDAY_LABELS[weekdayOf(p.y, p.m, p.d)];
  return (template || '')
    .replace(/\{date\}/gi, dateStr)
    .replace(/\{weekday\}/gi, weekday)
    .replace(/\{day\}/gi, String(p.d));
}

type AutomationRow = {
  id: string; ref: string | null; titleTemplate: string; detailTemplate: string | null; priority: string;
  dueInDays: number | null; assignMode: string; assigneeIds: string[]; roundRobinIdx: number;
};

/** Create the template's task(s) for one occurrence; returns created task ids. */
async function materialize(a: AutomationRow, inst: Date): Promise<string[]> {
  const { assignTaskRef } = await import('@/lib/task-refs');
  const { notifyStaffById } = await import('@/lib/notifications');
  const title = applyTokens(a.titleTemplate, inst).slice(0, 200) || 'Task';
  const detailBase = a.detailTemplate ? applyTokens(a.detailTemplate, inst).slice(0, 1900) : '';
  const detail = `${detailBase}${detailBase ? '\n\n' : ''}↻ Auto-created${a.ref ? ` by ${a.ref}` : ''}.`;
  const priority = ['LOW', 'NORMAL', 'HIGH'].includes(a.priority) ? a.priority : 'NORMAL';
  const dueAt = typeof a.dueInDays === 'number' ? new Date(inst.getTime() + a.dueInDays * 86400000) : null;

  // Resolve who gets it.
  let assignees: (string | null)[] = [null];
  const pool = (a.assigneeIds || []).filter(Boolean);
  if (pool.length) {
    if (a.assignMode === 'ALL') assignees = pool;
    else if (a.assignMode === 'ROUND_ROBIN') {
      assignees = [pool[a.roundRobinIdx % pool.length]];
      await db.taskAutomation.update({ where: { id: a.id }, data: { roundRobinIdx: (a.roundRobinIdx + 1) % pool.length } }).catch(() => {});
    } else assignees = [pool[0]]; // FIXED
  }

  const created: string[] = [];
  for (const assigneeId of assignees) {
    const task = await db.task.create({
      data: {
        title, detail, priority: priority as never, dueAt, assigneeId: assigneeId || null,
        createdBy: a.ref ? `automation:${a.ref}` : 'automation',
      },
      select: { id: true },
    });
    created.push(task.id);
    await assignTaskRef(task.id).catch(() => {});
    if (assigneeId) {
      await notifyStaffById(assigneeId, {
        kind: 'assigned', category: 'team', priority: priority === 'HIGH' ? 'high' : 'normal',
        title: 'New recurring task assigned to you', body: title, href: '/admin/tasks',
      }).catch(() => {});
    }
  }
  return created;
}

/** Claim an occurrence (idempotent) and materialise it. Returns created ids, or
 *  [] if the occurrence was already handled (unique-constraint race). */
async function fireOccurrence(a: AutomationRow, inst: Date, occurrenceKey: string, note: string): Promise<string[]> {
  try {
    await db.taskAutomationRun.create({ data: { automationId: a.id, occurrenceKey } });
  } catch {
    return []; // already claimed by an earlier/concurrent run
  }
  const created = await materialize(a, inst);
  await db.taskAutomationRun.updateMany({ where: { automationId: a.id, occurrenceKey }, data: { createdTaskIds: created, note } });
  return created;
}

/** Run all due SCHEDULE automations. Called by the dispatch + daily crons. */
export async function runDueTaskAutomations(now: Date = new Date()): Promise<{ fired: number; tasksCreated: number }> {
  const { ensureAutomationRefs } = await import('@/lib/task-refs');
  await ensureAutomationRefs().catch(() => {});
  let fired = 0, tasksCreated = 0;
  const autos = await db.taskAutomation.findMany({ where: { enabled: true, trigger: 'SCHEDULE' } }).catch(() => []);
  for (const a of autos) {
    try {
      const from = new Date(Math.max((a.lastRunAt?.getTime() ?? a.createdAt.getTime()), now.getTime() - LOOKBACK_MS));
      const occ = occurrencesInWindow(a, from, now).slice(0, MAX_PER_RUN);
      for (const inst of occ) {
        const lp = londonPartsOf(inst);
        const key = `${lp.y}-${String(lp.m).padStart(2, '0')}-${String(lp.d).padStart(2, '0')}T${String(lp.hh).padStart(2, '0')}:${String(lp.mm).padStart(2, '0')}`;
        const created = await fireOccurrence(a, inst, key, summarizeSchedule(a));
        if (created.length) { fired += 1; tasksCreated += created.length; }
      }
      const next = nextOccurrence(a, now);
      await db.taskAutomation.update({ where: { id: a.id }, data: { lastRunAt: now, nextRunAt: next } }).catch(() => {});
    } catch (e) {
      console.error('[task-automations] run failed for', a.id, (e as Error)?.message);
    }
  }
  return { fired, tasksCreated };
}

/** Trigger ON_TASK_COMPLETED automations whose matchText is in the task title. */
export async function onTaskCompleted(taskId: string, title: string): Promise<void> {
  try {
    const autos = await db.taskAutomation.findMany({ where: { enabled: true, trigger: 'ON_TASK_COMPLETED' } });
    const lower = (title || '').toLowerCase();
    for (const a of autos) {
      const match = (a.matchText || '').trim().toLowerCase();
      if (!match || !lower.includes(match)) continue;
      await fireOccurrence(a, new Date(), `completed:${taskId}`, `Follow-up after “${title.slice(0, 80)}”`);
    }
  } catch (e) {
    console.error('[task-automations] onTaskCompleted failed', (e as Error)?.message);
  }
}

/** Manually fire one occurrence now (the manager's "Run now" button). Idempotent
 *  to the minute so a double-click doesn't create duplicate tasks. */
export async function runNowOnce(automationId: string): Promise<number> {
  const a = await db.taskAutomation.findUnique({ where: { id: automationId } });
  if (!a) return 0;
  const now = new Date();
  const key = `manual:${now.toISOString().slice(0, 16)}`; // minute precision
  const created = await fireOccurrence(a, now, key, 'Run now (manual)');
  return created.length;
}

/** Recompute nextRunAt for one automation (after create/edit), for the UI. */
export async function refreshNextRun(automationId: string): Promise<void> {
  const a = await db.taskAutomation.findUnique({ where: { id: automationId } });
  if (!a) return;
  const next = a.enabled && a.trigger === 'SCHEDULE' ? nextOccurrence(a, new Date()) : null;
  await db.taskAutomation.update({ where: { id: automationId }, data: { nextRunAt: next } }).catch(() => {});
}
