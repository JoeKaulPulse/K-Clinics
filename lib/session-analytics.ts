import 'server-only';
import { db } from '@/lib/db';
import { SESSION_STEPS, normalizeTimings, type SessionStepKey, type StepTiming } from '@/lib/appointment-session';

// BLD-138 — appointment session timing analytics. Every completed session stores
// per-step timing ({ seconds, visits, skipped }) on AppointmentSession.steps.
// This aggregates those across sessions so the clinic can see where time goes:
// which sections run long, which get revisited (clinician went back), and which
// are skipped — exactly the operational insight the owner asked for to inform
// future development of the session flow.

export type StepStat = {
  key: SessionStepKey;
  label: string;
  sessions: number;     // sessions that recorded any time on this step
  avgSeconds: number;   // mean time across sessions that recorded it
  medianSeconds: number;
  skipRate: number;     // 0..1 — fraction of sessions where this step was skipped
  revisitRate: number;  // 0..1 — fraction where the step was entered more than once
};

export type SessionTimingStats = {
  totalSessions: number;          // completed sessions in range
  avgSessionSeconds: number;      // mean total (sum of step seconds) per session
  medianSessionSeconds: number;
  steps: StepStat[];
  slowest: StepStat | null;       // highest average time
  mostSkipped: StepStat | null;   // highest skip rate (min sample)
  mostRevisited: StepStat | null; // highest revisit rate (min sample)
};

const median = (xs: number[]): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

export async function getSessionTimingStats(opts: { since?: Date } = {}): Promise<SessionTimingStats> {
  const since = opts.since ?? new Date(0);
  const rows = await db.appointmentSession.findMany({
    where: { status: 'COMPLETED', completedAt: { gte: since } },
    select: { steps: true },
    take: 5000, // bounded; clinic-scale volume
  }).catch(() => [] as { steps: unknown }[]);

  // Per-step accumulators.
  const perStepSeconds: Record<string, number[]> = {};
  const skipCount: Record<string, number> = {};
  const revisitCount: Record<string, number> = {};
  const seenCount: Record<string, number> = {};
  const sessionTotals: number[] = [];

  for (const row of rows) {
    let timings: Partial<Record<SessionStepKey, StepTiming>>;
    try { timings = normalizeTimings((row.steps ?? {}) as Record<string, StepTiming | undefined>); }
    catch { continue; }
    let sessionTotal = 0;
    for (const def of SESSION_STEPS) {
      const t = timings[def.key];
      if (!t) continue;
      seenCount[def.key] = (seenCount[def.key] ?? 0) + 1;
      const secs = Math.max(0, t.seconds || 0);
      (perStepSeconds[def.key] ??= []).push(secs);
      sessionTotal += secs;
      if (t.skipped) skipCount[def.key] = (skipCount[def.key] ?? 0) + 1;
      if ((t.visits || 0) > 1) revisitCount[def.key] = (revisitCount[def.key] ?? 0) + 1;
    }
    if (sessionTotal > 0) sessionTotals.push(sessionTotal);
  }

  const steps: StepStat[] = SESSION_STEPS.map((def) => {
    const arr = perStepSeconds[def.key] ?? [];
    const seen = seenCount[def.key] ?? 0;
    const avg = arr.length ? Math.round(arr.reduce((s, n) => s + n, 0) / arr.length) : 0;
    return {
      key: def.key,
      label: def.label,
      sessions: seen,
      avgSeconds: avg,
      medianSeconds: median(arr),
      skipRate: seen ? (skipCount[def.key] ?? 0) / seen : 0,
      revisitRate: seen ? (revisitCount[def.key] ?? 0) / seen : 0,
    };
  });

  // Headline callouts require a minimum sample so a single odd session can't skew them.
  const MIN = Math.max(3, Math.round(rows.length * 0.1));
  const eligible = steps.filter((s) => s.sessions >= MIN);
  const slowest = eligible.length ? eligible.reduce((a, b) => (b.avgSeconds > a.avgSeconds ? b : a)) : null;
  const mostSkipped = eligible.length ? eligible.reduce((a, b) => (b.skipRate > a.skipRate ? b : a)) : null;
  const mostRevisited = eligible.length ? eligible.reduce((a, b) => (b.revisitRate > a.revisitRate ? b : a)) : null;

  return {
    totalSessions: rows.length,
    avgSessionSeconds: sessionTotals.length ? Math.round(sessionTotals.reduce((s, n) => s + n, 0) / sessionTotals.length) : 0,
    medianSessionSeconds: median(sessionTotals),
    steps,
    slowest,
    mostSkipped: mostSkipped && mostSkipped.skipRate > 0 ? mostSkipped : null,
    mostRevisited: mostRevisited && mostRevisited.revisitRate > 0 ? mostRevisited : null,
  };
}

export type ClinicianTimingStat = {
  clinicianId: string;
  name: string;
  sessions: number;          // completed sessions this clinician drove
  avgSessionSeconds: number; // their mean total session length
  medianSessionSeconds: number;
  slowestStep: string | null;   // the section they spend most time on (avg)
  mostRevisitedStep: string | null; // section they most often go back to
};

// BLD-138 (slice 2) — same per-step timing, grouped by the clinician who ran
// the session, so managers can see who runs long/short and where. Identity comes
// from the booking's practitioner; sessions with no practitioner are skipped.
export async function getClinicianTimingStats(opts: { since?: Date } = {}): Promise<ClinicianTimingStat[]> {
  const since = opts.since ?? new Date(0);
  const rows = await db.appointmentSession.findMany({
    where: { status: 'COMPLETED', completedAt: { gte: since } },
    select: { steps: true, booking: { select: { practitionerId: true, practitioner: { select: { name: true, email: true } } } } },
    take: 5000,
  }).catch(() => [] as { steps: unknown; booking: { practitionerId: string | null; practitioner: { name: string | null; email: string } | null } | null }[]);

  type Acc = { name: string; totals: number[]; stepSeconds: Record<string, number[]>; revisits: Record<string, number> };
  const byClin = new Map<string, Acc>();

  for (const row of rows) {
    const pid = row.booking?.practitionerId;
    if (!pid) continue; // can't attribute without a practitioner
    const name = row.booking?.practitioner?.name || row.booking?.practitioner?.email || 'Unknown';
    let timings: Partial<Record<SessionStepKey, StepTiming>>;
    try { timings = normalizeTimings((row.steps ?? {}) as Record<string, StepTiming | undefined>); }
    catch { continue; }
    const acc = byClin.get(pid) ?? { name, totals: [], stepSeconds: {}, revisits: {} };
    let total = 0;
    for (const def of SESSION_STEPS) {
      const t = timings[def.key];
      if (!t) continue;
      const secs = Math.max(0, t.seconds || 0);
      (acc.stepSeconds[def.key] ??= []).push(secs);
      total += secs;
      if ((t.visits || 0) > 1) acc.revisits[def.key] = (acc.revisits[def.key] ?? 0) + 1;
    }
    if (total > 0) acc.totals.push(total);
    byClin.set(pid, acc);
  }

  const labelOf = (key: string) => SESSION_STEPS.find((s) => s.key === key)?.label ?? key;

  const out: ClinicianTimingStat[] = [];
  for (const [clinicianId, acc] of byClin) {
    if (!acc.totals.length) continue;
    // Slowest section by this clinician's average time on it.
    let slowestStep: string | null = null; let slowestAvg = -1;
    for (const [key, arr] of Object.entries(acc.stepSeconds)) {
      const avg = arr.reduce((s, n) => s + n, 0) / arr.length;
      if (avg > slowestAvg) { slowestAvg = avg; slowestStep = labelOf(key); }
    }
    let mostRevisitedStep: string | null = null; let topRev = 0;
    for (const [key, n] of Object.entries(acc.revisits)) {
      if (n > topRev) { topRev = n; mostRevisitedStep = labelOf(key); }
    }
    out.push({
      clinicianId,
      name: acc.name,
      sessions: acc.totals.length,
      avgSessionSeconds: Math.round(acc.totals.reduce((s, n) => s + n, 0) / acc.totals.length),
      medianSessionSeconds: median(acc.totals),
      slowestStep,
      mostRevisitedStep,
    });
  }
  // Busiest clinicians first.
  return out.sort((a, b) => b.sessions - a.sessions);
}

/** Format seconds as a compact human duration (e.g. "2m 05s", "48s"). */
export function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}m ${String(s).padStart(2, '0')}s` : `${m}m`;
}
