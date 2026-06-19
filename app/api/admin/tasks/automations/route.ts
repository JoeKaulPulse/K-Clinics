import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Task automations manager — admins create recurring ("repeat events") and
// trigger-based work that auto-assigns tasks to staff. Gated by tasks.automate.

const FREQS = ['DAILY', 'WEEKLY', 'MONTHLY'];
const ASSIGN_MODES = ['FIXED', 'ROUND_ROBIN', 'ALL'];
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH'];
const TRIGGERS = ['SCHEDULE', 'ON_TASK_COMPLETED'];

type Body = {
  op?: string; id?: string; enabled?: boolean;
  name?: string; description?: string; trigger?: string;
  freq?: string; interval?: number; daysOfWeek?: number[]; dayOfMonth?: number; timeOfDay?: string;
  startsOn?: string; endsOn?: string; matchText?: string;
  titleTemplate?: string; detailTemplate?: string; priority?: string; dueInDays?: number;
  assignMode?: string; assigneeIds?: string[];
};

function cleanInput(b: Body) {
  const clampInt = (v: unknown, lo: number, hi: number, dflt: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
  };
  return {
    name: (b.name || '').trim().slice(0, 120) || 'Untitled automation',
    description: (b.description || '').trim().slice(0, 500) || null,
    trigger: TRIGGERS.includes(b.trigger || '') ? b.trigger! : 'SCHEDULE',
    freq: FREQS.includes(b.freq || '') ? b.freq! : 'WEEKLY',
    interval: clampInt(b.interval, 1, 52, 1),
    daysOfWeek: Array.isArray(b.daysOfWeek) ? Array.from(new Set(b.daysOfWeek.map((d) => clampInt(d, 0, 6, 1)))) : [],
    dayOfMonth: b.dayOfMonth != null ? clampInt(b.dayOfMonth, 1, 28, 1) : null,
    timeOfDay: /^\d{1,2}:\d{2}$/.test(b.timeOfDay || '') ? b.timeOfDay! : '09:00',
    startsOn: b.startsOn && !isNaN(Date.parse(b.startsOn)) ? new Date(b.startsOn) : null,
    endsOn: b.endsOn && !isNaN(Date.parse(b.endsOn)) ? new Date(b.endsOn) : null,
    matchText: (b.matchText || '').trim().slice(0, 120) || null,
    titleTemplate: (b.titleTemplate || '').trim().slice(0, 200) || 'Recurring task',
    detailTemplate: (b.detailTemplate || '').trim().slice(0, 1900) || null,
    priority: PRIORITIES.includes(b.priority || '') ? b.priority! : 'NORMAL',
    dueInDays: b.dueInDays != null ? clampInt(b.dueInDays, 0, 365, 0) : null,
    assignMode: ASSIGN_MODES.includes(b.assignMode || '') ? b.assignMode! : 'FIXED',
    assigneeIds: Array.isArray(b.assigneeIds) ? Array.from(new Set(b.assigneeIds.map(String))).slice(0, 50) : [],
  };
}

export async function GET() {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  if (!(await requirePermission('tasks.automate'))) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
  const { db } = await import('@/lib/db');
  const { ensureAutomationRefs } = await import('@/lib/task-refs');
  await ensureAutomationRefs().catch(() => {});
  const { summarizeSchedule } = await import('@/lib/task-automations');

  const [autos, staff] = await Promise.all([
    db.taskAutomation.findMany({ orderBy: { createdAt: 'desc' }, include: { _count: { select: { runs: true } } } }),
    db.adminUser.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, email: true } }),
  ]);
  return NextResponse.json({
    ok: true,
    staff: staff.map((s) => ({ id: s.id, name: s.name || s.email })),
    automations: autos.map((a) => ({
      id: a.id, ref: a.ref, name: a.name, description: a.description, enabled: a.enabled, trigger: a.trigger,
      freq: a.freq, interval: a.interval, daysOfWeek: a.daysOfWeek, dayOfMonth: a.dayOfMonth, timeOfDay: a.timeOfDay,
      startsOn: a.startsOn?.toISOString() || null, endsOn: a.endsOn?.toISOString() || null, matchText: a.matchText,
      titleTemplate: a.titleTemplate, detailTemplate: a.detailTemplate, priority: a.priority, dueInDays: a.dueInDays,
      assignMode: a.assignMode, assigneeIds: a.assigneeIds,
      summary: a.trigger === 'SCHEDULE' ? summarizeSchedule(a) : `When a task containing “${a.matchText || '…'}” is completed`,
      nextRunAt: a.nextRunAt?.toISOString() || null, lastRunAt: a.lastRunAt?.toISOString() || null, runCount: a._count.runs,
    })),
  });
}

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('tasks.automate');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
  const { db } = await import('@/lib/db');
  const b = (await req.json().catch(() => ({}))) as Body;

  try {
    if (b.op === 'create') {
      const data = cleanInput(b);
      const created = await db.taskAutomation.create({ data: { ...data, createdById: session.sub } as never, select: { id: true } });
      const { assignAutomationRef } = await import('@/lib/task-refs');
      const ref = await assignAutomationRef(created.id).catch(() => null);
      const { refreshNextRun } = await import('@/lib/task-automations');
      await refreshNextRun(created.id).catch(() => {});
      return NextResponse.json({ ok: true, id: created.id, ref });
    }
    if (b.op === 'update') {
      if (!b.id) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
      const data = cleanInput(b);
      await db.taskAutomation.update({ where: { id: b.id }, data: data as never });
      const { refreshNextRun } = await import('@/lib/task-automations');
      await refreshNextRun(b.id).catch(() => {});
      return NextResponse.json({ ok: true });
    }
    if (b.op === 'toggle') {
      if (!b.id) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
      await db.taskAutomation.update({ where: { id: b.id }, data: { enabled: Boolean(b.enabled) } });
      const { refreshNextRun } = await import('@/lib/task-automations');
      await refreshNextRun(b.id).catch(() => {});
      return NextResponse.json({ ok: true });
    }
    if (b.op === 'delete') {
      if (!b.id) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
      await db.taskAutomation.delete({ where: { id: b.id } }).catch(() => {});
      return NextResponse.json({ ok: true });
    }
    if (b.op === 'runNow') {
      // Materialise one occurrence immediately (manual fire), idempotent per minute.
      if (!b.id) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
      const a = await db.taskAutomation.findUnique({ where: { id: b.id } });
      if (!a) return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });
      const { runNowOnce } = await import('@/lib/task-automations');
      const created = await runNowOnce(a.id);
      return NextResponse.json({ ok: true, created });
    }
    return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error)?.message || 'Something went wrong.' }, { status: 400 });
  }
}
