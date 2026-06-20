import 'server-only';
import { db } from '@/lib/db';
import { currentTenantId } from '@/lib/tenant';
import { scoreAndBadge } from '@/lib/academy-gamification';

// ── BLD-539: "spot the mistake" demo walkthroughs ────────────────────────────
// Staff mark time windows where the practitioner does something wrong; learners
// press space when they think they see one. Graded SERVER-SIDE — the mistake
// timings never reach the player until after grading.

export type DemoCard = { id: string; title: string; description: string | null; courseTitle: string | null; mistakeCount: number; best: number | null };
export type DemoPlay = { id: string; title: string; description: string | null; videoUrl: string; durationSec: number | null; mistakeCount: number; best: number | null };
export type DemoMistakeResult = { atSec: number; label: string; caught: boolean };
export type DemoResult = { ok: boolean; error?: string; spotted?: number; total?: number; falsePositives?: number; scorePct?: number; mistakes?: DemoMistakeResult[] };

/** Active demos across the given courses (answer-free), with the student's best score. */
export async function listDemos(courseIds: string[], studentId: string): Promise<DemoCard[]> {
  if (courseIds.length === 0) return [];
  const rows = await db.demoVideo.findMany({
    where: { courseId: { in: courseIds }, active: true }, orderBy: { order: 'asc' }, take: 100,
    include: { course: { select: { title: true } }, _count: { select: { mistakes: true } } },
  });
  if (rows.length === 0) return [];
  const attempts = await db.demoAttempt.findMany({ where: { studentId, videoId: { in: rows.map((r) => r.id) } }, select: { videoId: true, scorePct: true } });
  const best = new Map(attempts.map((a) => [a.videoId, a.scorePct]));
  return rows.filter((r) => r._count.mistakes > 0).map((r) => ({ id: r.id, title: r.title, description: r.description, courseTitle: r.course?.title ?? null, mistakeCount: r._count.mistakes, best: best.get(r.id) ?? null }));
}

/** A single demo's play view — never includes mistake timings. */
export async function getDemoPlay(id: string, studentId: string): Promise<DemoPlay | null> {
  const r = await db.demoVideo.findFirst({ where: { id, active: true }, include: { _count: { select: { mistakes: true } } } });
  if (!r || r._count.mistakes === 0) return null;
  const a = await db.demoAttempt.findUnique({ where: { studentId_videoId: { studentId, videoId: id } }, select: { scorePct: true } }).catch(() => null);
  return { id: r.id, title: r.title, description: r.description, videoUrl: r.videoUrl, durationSec: r.durationSec, mistakeCount: r._count.mistakes, best: a?.scorePct ?? null };
}

/** Grade a learner's spacebar presses (seconds) against the marked mistakes. */
export async function gradeDemo(studentId: string, videoId: string, presses: unknown): Promise<DemoResult> {
  const v = await db.demoVideo.findFirst({
    where: { id: videoId, active: true },
    select: { id: true, courseId: true, mistakes: { select: { atSec: true, windowSec: true, label: true }, orderBy: { atSec: 'asc' } } },
  });
  if (!v) return { ok: false, error: 'Demo not found.' };
  const mistakes = v.mistakes;
  const total = mistakes.length;
  if (total === 0) return { ok: false, error: 'This demo has no marked mistakes yet.' };

  const ts = (Array.isArray(presses) ? presses : []).map(Number).filter((n) => Number.isFinite(n) && n >= 0).sort((a, b) => a - b).slice(0, 300);
  const caught = new Array(total).fill(false);
  let matchedPresses = 0;
  // Each press matches at most one not-yet-caught mistake whose window contains it.
  // Allow a 0.75s early reaction; the window extends windowSec after the event.
  for (const t of ts) {
    for (let mi = 0; mi < total; mi++) {
      if (caught[mi]) continue;
      const m = mistakes[mi];
      if (t >= m.atSec - 0.75 && t <= m.atSec + m.windowSec) { caught[mi] = true; matchedPresses++; break; }
    }
  }
  const spotted = caught.filter(Boolean).length;
  const falsePositives = Math.max(0, ts.length - matchedPresses);
  // Score rewards spotting and lightly penalises spamming flags (a false flag
  // cancels up to one spot), floored at 0.
  const net = Math.max(0, spotted - Math.min(falsePositives, spotted));
  const scorePct = Math.round((net / total) * 100);

  try {
    const tenantId = await currentTenantId();
    const prior = await db.demoAttempt.findUnique({ where: { studentId_videoId: { studentId, videoId } }, select: { id: true, scorePct: true } });
    if (!prior) {
      await db.demoAttempt.create({ data: { tenantId, studentId, videoId, spotted, total, falsePositives, scorePct, attempts: 1 } });
      await scoreAndBadge(studentId, 'DEMO', 5 + (scorePct === 100 ? 5 : 0), v.courseId).catch(() => {});
    } else {
      await db.demoAttempt.update({ where: { id: prior.id }, data: { spotted, total, falsePositives, scorePct: Math.max(prior.scorePct, scorePct), attempts: { increment: 1 } } });
    }
  } catch { /* scoring is best-effort */ }

  return { ok: true, spotted, total, falsePositives, scorePct, mistakes: mistakes.map((m, i) => ({ atSec: m.atSec, label: m.label, caught: caught[i] })) };
}

// ── admin authoring ──────────────────────────────────────────────────────────
export type AdminDemoMistake = { id: string; atSec: number; windowSec: number; label: string };
export type AdminDemo = { id: string; courseId: string | null; title: string; description: string | null; videoUrl: string; durationSec: number | null; order: number; active: boolean; mistakes: AdminDemoMistake[] };

export async function adminListDemos(courseId: string): Promise<AdminDemo[]> {
  const rows = await db.demoVideo.findMany({ where: { courseId }, orderBy: { order: 'asc' }, include: { mistakes: { orderBy: { atSec: 'asc' } } } });
  return rows.map((r) => ({
    id: r.id, courseId: r.courseId, title: r.title, description: r.description, videoUrl: r.videoUrl, durationSec: r.durationSec, order: r.order, active: r.active,
    mistakes: r.mistakes.map((m) => ({ id: m.id, atSec: m.atSec, windowSec: m.windowSec, label: m.label })),
  }));
}
