import 'server-only';
import { db } from '@/lib/db';
import { currentTenantId } from '@/lib/tenant';
import { scoreAndBadge } from '@/lib/academy-gamification';
import { studentCanAccess } from '@/lib/lms';

// ── BLD-535 / BLD-536: interactive self-check exercises ──────────────────────
// All graded SERVER-SIDE against the stored `config` so the answer key never
// reaches the browser:
//   HOTSPOT — click the right place on an image for each labelled structure.
//             config: { spots: [{ label, x, y, r }] }   (x,y,r are % of image)
//   MATCH   — pair each left item with its correct right item.
//             config: { pairs: [{ left, right }] }
//   ORDER   — put the steps into the correct sequence.
//             config: { items: [string] }  (stored already in correct order)
//   LABEL   — drag the right label onto each marked point on a diagram.
//             config: { points: [{ x, y, label }] }
//   TYPEIN  — type what each marked point on a diagram is.
//             config: { targets: [{ x, y, accepted: [string] }] }

export const EXERCISE_TYPES = [
  { key: 'HOTSPOT', label: 'Image hotspots' },
  { key: 'MATCH', label: 'Match pairs' },
  { key: 'ORDER', label: 'Order the steps' },
  { key: 'LABEL', label: 'Label the diagram' },
  { key: 'TYPEIN', label: 'Name on image (type)' },
] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number]['key'];

export type HotspotSpot = { label: string; x: number; y: number; r: number };
export type MatchPair = { left: string; right: string };
export type LabelPoint = { label: string; x: number; y: number };
export type TypeinTarget = { accepted: string[]; x: number; y: number };
type Config = { spots?: HotspotSpot[]; pairs?: MatchPair[]; items?: string[]; points?: LabelPoint[]; targets?: TypeinTarget[] };

// ── safe parsing ─────────────────────────────────────────────────────────────
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const clampPct = (v: unknown) => Math.max(0, Math.min(100, num(v)));
const sstr = (v: unknown) => (typeof v === 'string' ? v : '');

function parseConfig(type: string, raw: unknown): Config {
  const c = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (type === 'HOTSPOT') {
    const spots = Array.isArray(c.spots) ? c.spots : [];
    return { spots: spots.slice(0, 30).map((s) => { const o = (s ?? {}) as Record<string, unknown>; return { label: sstr(o.label).slice(0, 120), x: clampPct(o.x), y: clampPct(o.y), r: Math.max(2, Math.min(40, num(o.r, 8))) }; }).filter((s) => s.label) };
  }
  if (type === 'MATCH') {
    const pairs = Array.isArray(c.pairs) ? c.pairs : [];
    return { pairs: pairs.slice(0, 30).map((p) => { const o = (p ?? {}) as Record<string, unknown>; return { left: sstr(o.left).slice(0, 200), right: sstr(o.right).slice(0, 200) }; }).filter((p) => p.left && p.right) };
  }
  if (type === 'ORDER') {
    const items = Array.isArray(c.items) ? c.items : [];
    return { items: items.slice(0, 30).map((i) => sstr(i).slice(0, 200)).filter(Boolean) };
  }
  if (type === 'LABEL') {
    const points = Array.isArray(c.points) ? c.points : [];
    return { points: points.slice(0, 30).map((p) => { const o = (p ?? {}) as Record<string, unknown>; return { label: sstr(o.label).slice(0, 120), x: clampPct(o.x), y: clampPct(o.y) }; }).filter((p) => p.label) };
  }
  if (type === 'TYPEIN') {
    const targets = Array.isArray(c.targets) ? c.targets : [];
    return { targets: targets.slice(0, 30).map((t) => { const o = (t ?? {}) as Record<string, unknown>; const accepted = (Array.isArray(o.accepted) ? o.accepted : []).map((a) => sstr(a).slice(0, 120)).filter(Boolean); return { accepted, x: clampPct(o.x), y: clampPct(o.y) }; }).filter((t) => t.accepted.length > 0) };
  }
  return {};
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

const shuffle = <T,>(a: T[]): T[] => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

// ── learner-facing (answer-free) views ───────────────────────────────────────
export type ExercisePlay = {
  id: string; title: string; type: string; instructions: string | null; imageUrl: string | null;
  labels?: string[]; // HOTSPOT — what to find (coordinates withheld)
  lefts?: string[]; rights?: string[]; // MATCH — rights shuffled
  items?: string[]; // ORDER — shuffled
  points?: { x: number; y: number }[]; // LABEL / TYPEIN — marker positions (answers withheld)
  bank?: string[]; // LABEL — shuffled label bank
  count: number; best: number | null;
};

function toPlay(e: { id: string; title: string; type: string; instructions: string | null; imageUrl: string | null; config: unknown }, best: number | null): ExercisePlay {
  const cfg = parseConfig(e.type, e.config);
  const base = { id: e.id, title: e.title, type: e.type, instructions: e.instructions, imageUrl: e.imageUrl, best };
  if (e.type === 'HOTSPOT') return { ...base, labels: (cfg.spots ?? []).map((s) => s.label), count: cfg.spots?.length ?? 0 };
  if (e.type === 'MATCH') { const pairs = cfg.pairs ?? []; return { ...base, lefts: pairs.map((p) => p.left), rights: shuffle(pairs.map((p) => p.right)), count: pairs.length }; }
  if (e.type === 'ORDER') { const items = cfg.items ?? []; return { ...base, items: items.length > 1 ? reshuffle(items) : items, count: items.length }; }
  if (e.type === 'LABEL') { const points = cfg.points ?? []; return { ...base, points: points.map((p) => ({ x: p.x, y: p.y })), bank: shuffle(points.map((p) => p.label)), count: points.length }; }
  if (e.type === 'TYPEIN') { const targets = cfg.targets ?? []; return { ...base, points: targets.map((t) => ({ x: t.x, y: t.y })), count: targets.length }; }
  return { ...base, count: 0 };
}
// Avoid presenting ORDER already-correct: reshuffle until it differs (or give up).
function reshuffle(items: string[]): string[] { for (let i = 0; i < 6; i++) { const s = shuffle(items); if (s.some((v, idx) => v !== items[idx])) return s; } return shuffle(items); }

/** Active exercises for a course (answer-free), with the student's best score. */
export async function listExercises(courseId: string, studentId: string): Promise<ExercisePlay[]> {
  const rows = await db.interactiveExercise.findMany({ where: { courseId, active: true }, orderBy: { order: 'asc' }, take: 100 });
  if (rows.length === 0) return [];
  const attempts = await db.exerciseAttempt.findMany({ where: { studentId, exerciseId: { in: rows.map((r) => r.id) } }, select: { exerciseId: true, scorePct: true } });
  const best = new Map(attempts.map((a) => [a.exerciseId, a.scorePct]));
  return rows.map((r) => toPlay(r, best.get(r.id) ?? null)).filter((p) => p.count > 0);
}

/** Count of active exercises across the student's enrolled courses (for nav/landing). */
export async function exerciseCountForStudent(courseIds: string[]): Promise<number> {
  if (courseIds.length === 0) return 0;
  return db.interactiveExercise.count({ where: { courseId: { in: courseIds }, active: true } });
}

// ── grading (server-side) ────────────────────────────────────────────────────
export type GradeResult = { ok: boolean; error?: string; scorePct?: number; correct?: number; total?: number; results?: boolean[]; reveal?: unknown };

const dist = (ax: number, ay: number, bx: number, by: number) => Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);

/** Grade a submission against the stored config; record best score + award XP. */
export async function gradeExercise(studentId: string, exerciseId: string, answer: unknown): Promise<GradeResult> {
  const e = await db.interactiveExercise.findFirst({ where: { id: exerciseId, active: true }, select: { id: true, type: true, courseId: true, config: true } });
  if (!e) return { ok: false, error: 'Exercise not found.' };
  // BLD-706: verify the student is enrolled on the course this exercise belongs to.
  if (!(await studentCanAccess(studentId, e.courseId))) return { ok: false, error: 'Not enrolled.' };
  const cfg = parseConfig(e.type, e.config);

  let total = 0, correct = 0; const results: boolean[] = []; let reveal: unknown;

  if (e.type === 'HOTSPOT') {
    const spots = cfg.spots ?? [];
    const clicks = (answer && typeof answer === 'object' ? answer : {}) as Record<string, { x?: unknown; y?: unknown }>;
    total = spots.length;
    spots.forEach((s, i) => { const c = clicks[i] ?? clicks[String(i)]; const hit = !!c && dist(clampPct(c.x), clampPct(c.y), s.x, s.y) <= s.r; results.push(hit); if (hit) correct++; });
    reveal = spots; // after grading, reveal the correct spots for learning
  } else if (e.type === 'MATCH') {
    const pairs = cfg.pairs ?? [];
    const picks = (answer && typeof answer === 'object' ? answer : {}) as Record<string, unknown>;
    total = pairs.length;
    pairs.forEach((p, i) => { const chosen = sstr(picks[i] ?? picks[String(i)]); const hit = chosen === p.right; results.push(hit); if (hit) correct++; });
    reveal = pairs;
  } else if (e.type === 'ORDER') {
    const items = cfg.items ?? [];
    const ordered = Array.isArray(answer) ? (answer as unknown[]).map(sstr) : [];
    total = items.length;
    items.forEach((it, i) => { const hit = ordered[i] === it; results.push(hit); if (hit) correct++; });
    reveal = items;
  } else if (e.type === 'LABEL') {
    const points = cfg.points ?? [];
    const picks = (answer && typeof answer === 'object' ? answer : {}) as Record<string, unknown>;
    total = points.length;
    points.forEach((p, i) => { const chosen = sstr(picks[i] ?? picks[String(i)]); const hit = chosen === p.label; results.push(hit); if (hit) correct++; });
    reveal = points; // {x,y,label} — player shows the correct label at each marker
  } else if (e.type === 'TYPEIN') {
    const targets = cfg.targets ?? [];
    const typed = (answer && typeof answer === 'object' ? answer : {}) as Record<string, unknown>;
    total = targets.length;
    targets.forEach((t, i) => { const ans = norm(sstr(typed[i] ?? typed[String(i)])); const hit = !!ans && t.accepted.some((a) => norm(a) === ans); results.push(hit); if (hit) correct++; });
    reveal = targets.map((t) => ({ x: t.x, y: t.y, label: t.accepted[0] ?? '' }));
  } else {
    return { ok: false, error: 'Unsupported exercise.' };
  }

  if (total === 0) return { ok: false, error: 'This exercise has no content yet.' };
  const scorePct = Math.round((correct / total) * 100);

  // Record best score; award XP only the first time the student completes it.
  try {
    const tenantId = await currentTenantId();
    const prior = await db.exerciseAttempt.findUnique({ where: { studentId_exerciseId: { studentId, exerciseId } }, select: { id: true, scorePct: true, attempts: true } });
    if (!prior) {
      await db.exerciseAttempt.create({ data: { tenantId, studentId, exerciseId, scorePct, attempts: 1 } });
      await scoreAndBadge(studentId, 'EXERCISE', 5 + (scorePct === 100 ? 5 : 0), e.courseId).catch(() => {});
    } else {
      await db.exerciseAttempt.update({ where: { id: prior.id }, data: { scorePct: Math.max(prior.scorePct, scorePct), attempts: { increment: 1 } } });
    }
  } catch { /* scoring is best-effort */ }

  return { ok: true, scorePct, correct, total, results, reveal };
}

// ── admin authoring ──────────────────────────────────────────────────────────
export type AdminExercise = { id: string; courseId: string; title: string; type: string; instructions: string | null; imageUrl: string | null; config: Config; order: number; active: boolean };

export async function adminListExercises(courseId: string): Promise<AdminExercise[]> {
  const rows = await db.interactiveExercise.findMany({ where: { courseId }, orderBy: { order: 'asc' } });
  return rows.map((r) => ({ id: r.id, courseId: r.courseId, title: r.title, type: r.type, instructions: r.instructions, imageUrl: r.imageUrl, config: parseConfig(r.type, r.config), order: r.order, active: r.active }));
}

export function normaliseConfig(type: string, raw: unknown): Config { return parseConfig(type, raw); }
