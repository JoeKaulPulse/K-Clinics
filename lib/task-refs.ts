import 'server-only';
import { db } from '@/lib/db';

// ─────────────────────────────────────────────────────────────────────────────
// Task reference IDs — stable, human-readable identifiers for tracing, search
// and identification across every board.
//
// Scheme (immutable once assigned; gaps in numbering are normal):
//   TSK-12          internal Tasks board, top-level task
//   TSK-12.1        sub-task of TSK-12 (branches share the parent's root)
//   BLD-7           Build & Issues item created standalone
//   BLD-7.2         subtask 2 of build item BLD-7
//   PRJ-3           Build project (the root of its group)
//   PRJ-3.1         build item created/seeded inside project PRJ-3
//   PRJ-3.1.2       subtask 2 of that item
//
// Uniqueness is structural, NOT a DB constraint — the deploy gate (`prisma db
// push` without --accept-data-loss) refuses to add unique constraints to
// existing tables, so none are declared:
//   • seq comes from a Postgres sequence (unique by construction), and root
//     refs derive from seq, so they can never collide;
//   • child refs (the dotted branches) are allocated inside a transaction that
//     row-locks the parent (SELECT … FOR UPDATE), serialising concurrent
//     sibling creation;
//   • the ensure* backfills include a dedupe pass that re-assigns any
//     duplicate ref that slips through, so the system self-heals.
//
// Cite these refs in commits, PRs, audit findings and reports so work is
// traceable end-to-end (board → code → deploy).
// ─────────────────────────────────────────────────────────────────────────────

export const TASK_REF_PREFIX = 'TSK';
export const BUILD_REF_PREFIX = 'BLD';
export const PROJECT_REF_PREFIX = 'PRJ';
export const AUTOMATION_REF_PREFIX = 'AUT';

/** How many levels deep a ref is (TSK-1 → 1, TSK-1.2 → 2, TSK-1.2.3 → 3). */
export function refDepth(ref: string): number {
  return ref.split('.').length;
}

/** Sub-tasks may nest, but refs stay readable: cap branches at 3 levels. */
export const MAX_REF_DEPTH = 3;

/** Next numeric suffix for a child of `parentRef`, given its siblings' refs. */
export function nextChildSuffix(parentRef: string, siblingRefs: (string | null)[]): number {
  let max = 0;
  for (const r of siblingRefs) {
    if (!r || !r.startsWith(`${parentRef}.`)) continue;
    const tail = Number(r.slice(parentRef.length + 1));
    if (Number.isInteger(tail) && tail > max) max = tail;
  }
  return max + 1;
}

// ── Internal Tasks board ─────────────────────────────────────────────────────

/** Assign `ref` to a freshly created task: TSK-<seq> for top-level tasks, or the
 *  next branch of the parent's ref for sub-tasks. Sibling allocation is
 *  serialised by row-locking the parent, so concurrent creates can't collide. */
export async function assignTaskRef(taskId: string): Promise<string | null> {
  const task = await db.task.findUnique({ where: { id: taskId }, select: { seq: true, ref: true, parentId: true } });
  if (!task) return null;
  if (task.ref) return task.ref;

  if (!task.parentId) {
    const ref = `${TASK_REF_PREFIX}-${task.seq}`;
    await db.task.update({ where: { id: taskId }, data: { ref } });
    return ref;
  }

  const parent = await db.task.findUnique({ where: { id: task.parentId }, select: { id: true, ref: true } });
  // A parent without a ref shouldn't happen (parents are created/backfilled
  // first), but never leave the child unidentifiable — fall back to a root ref.
  const parentRef = parent?.ref || (parent ? await assignTaskRef(parent.id) : null);
  if (!parentRef) {
    const ref = `${TASK_REF_PREFIX}-${task.seq}`;
    await db.task.update({ where: { id: taskId }, data: { ref } });
    return ref;
  }

  const parentId = task.parentId;
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Task" WHERE "id" = ${parentId} FOR UPDATE`;
    const siblings = await tx.task.findMany({ where: { parentId }, select: { ref: true } });
    const ref = `${parentRef}.${nextChildSuffix(parentRef, siblings.map((s) => s.ref))}`;
    await tx.task.update({ where: { id: taskId }, data: { ref } });
    return ref;
  });
}

let taskRefsChecked = false;
/** Backfill refs for tasks created before the scheme existed, and re-assign any
 *  duplicate ref (self-healing). Parents first so sub-tasks always have a parent
 *  ref to branch from. Idempotent + memoised per warm process. */
export async function ensureTaskRefs(): Promise<void> {
  if (taskRefsChecked) return;
  try {
    const missing = await db.task.count({ where: { ref: null } });
    if (missing > 0) {
      // Roots first, then descend one level per pass (oldest first within a level).
      for (let depth = 0; depth < MAX_REF_DEPTH; depth++) {
        const batch = await db.task.findMany({
          where: { ref: null, ...(depth === 0 ? { parentId: null } : { parentId: { not: null } }) },
          orderBy: { seq: 'asc' },
          select: { id: true },
        });
        if (!batch.length) break;
        for (const t of batch) await assignTaskRef(t.id).catch(() => {});
      }
    }
    // Dedupe: if a race ever produced the same ref twice, keep the oldest and
    // re-assign the rest.
    const dups = await db.$queryRaw<{ ref: string }[]>`SELECT "ref" FROM "Task" WHERE "ref" IS NOT NULL GROUP BY "ref" HAVING COUNT(*) > 1`;
    for (const { ref } of dups) {
      const rows = await db.task.findMany({ where: { ref }, orderBy: { seq: 'asc' }, select: { id: true } });
      for (const r of rows.slice(1)) {
        await db.task.update({ where: { id: r.id }, data: { ref: null } });
        await assignTaskRef(r.id).catch(() => {});
      }
    }
    taskRefsChecked = true;
  } catch (e) {
    console.error('[task-refs] task backfill failed', e);
  }
}

// ── Task automations ─────────────────────────────────────────────────────────

/** Assign `ref` to a task automation: AUT-<seq>. seq is a Postgres sequence so
 *  it's unique by construction (no transaction needed). Idempotent. */
export async function assignAutomationRef(automationId: string): Promise<string | null> {
  const a = await db.taskAutomation.findUnique({ where: { id: automationId }, select: { seq: true, ref: true } });
  if (!a) return null;
  if (a.ref) return a.ref;
  const ref = `${AUTOMATION_REF_PREFIX}-${a.seq}`;
  await db.taskAutomation.update({ where: { id: automationId }, data: { ref } });
  return ref;
}

let automationRefsChecked = false;
/** Backfill AUT- refs for any automation missing one. Idempotent + memoised. */
export async function ensureAutomationRefs(): Promise<void> {
  if (automationRefsChecked) return;
  try {
    const missing = await db.taskAutomation.findMany({ where: { ref: null }, orderBy: { seq: 'asc' }, select: { id: true } });
    for (const a of missing) await assignAutomationRef(a.id).catch(() => {});
    automationRefsChecked = true;
  } catch (e) {
    console.error('[task-refs] automation backfill failed', e);
  }
}

// ── Build & Issues board ─────────────────────────────────────────────────────

/** Assign `ref` to a build item: a branch of its project's ref when it belongs
 *  to one at creation time, else BLD-<seq>. Immutable afterwards. */
export async function assignBuildItemRef(itemId: string): Promise<string | null> {
  const item = await db.buildItem.findUnique({ where: { id: itemId }, select: { seq: true, ref: true, projectId: true } });
  if (!item) return null;
  if (item.ref) return item.ref;

  if (item.projectId) {
    const projectId = item.projectId;
    const projectRef = await assignProjectRef(projectId);
    if (projectRef) {
      return db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "BuildProject" WHERE "id" = ${projectId} FOR UPDATE`;
        const siblings = await tx.buildItem.findMany({ where: { projectId }, select: { ref: true } });
        const ref = `${projectRef}.${nextChildSuffix(projectRef, siblings.map((s) => s.ref))}`;
        await tx.buildItem.update({ where: { id: itemId }, data: { ref } });
        return ref;
      });
    }
  }

  const ref = `${BUILD_REF_PREFIX}-${item.seq}`;
  await db.buildItem.update({ where: { id: itemId }, data: { ref } });
  return ref;
}

/** Assign `ref` to a build project: PRJ-<seq>. */
export async function assignProjectRef(projectId: string): Promise<string | null> {
  const p = await db.buildProject.findUnique({ where: { id: projectId }, select: { seq: true, ref: true } });
  if (!p) return null;
  if (p.ref) return p.ref;
  const ref = `${PROJECT_REF_PREFIX}-${p.seq}`;
  await db.buildProject.update({ where: { id: projectId }, data: { ref } });
  return ref;
}

/** Assign `ref` to a build subtask: the next branch of its parent item's ref. */
export async function assignBuildSubtaskRef(subtaskId: string): Promise<string | null> {
  const sub = await db.buildSubtask.findUnique({ where: { id: subtaskId }, select: { ref: true, itemId: true } });
  if (!sub) return null;
  if (sub.ref) return sub.ref;
  const itemRef = await assignBuildItemRef(sub.itemId);
  if (!itemRef) return null;
  const itemId = sub.itemId;
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "BuildItem" WHERE "id" = ${itemId} FOR UPDATE`;
    const siblings = await tx.buildSubtask.findMany({ where: { itemId }, select: { ref: true } });
    const ref = `${itemRef}.${nextChildSuffix(itemRef, siblings.map((s) => s.ref))}`;
    await tx.buildSubtask.update({ where: { id: subtaskId }, data: { ref } });
    return ref;
  });
}

let buildRefsChecked = false;
/** Backfill refs across the Build board: projects → items → subtasks, oldest
 *  first, so grouped work numbers in creation order and branches always have a
 *  root. Runs after project links are synced (see ensureBacklogSeeded) so
 *  pre-existing project members get PRJ-branch refs. Includes the duplicate-ref
 *  self-heal. Idempotent + memoised; pass force=true after seeding new items
 *  (the memo would otherwise skip them). */
export async function ensureBuildRefs(force = false): Promise<void> {
  if (buildRefsChecked && !force) return;
  try {
    const [projects, items, subtasks] = await Promise.all([
      db.buildProject.count({ where: { ref: null } }),
      db.buildItem.count({ where: { ref: null } }),
      db.buildSubtask.count({ where: { ref: null } }),
    ]);
    if (projects > 0) {
      for (const p of await db.buildProject.findMany({ where: { ref: null }, orderBy: { seq: 'asc' }, select: { id: true } })) {
        await assignProjectRef(p.id).catch(() => {});
      }
    }
    if (items > 0) {
      for (const i of await db.buildItem.findMany({ where: { ref: null }, orderBy: { seq: 'asc' }, select: { id: true } })) {
        await assignBuildItemRef(i.id).catch(() => {});
      }
    }
    if (subtasks > 0) {
      for (const s of await db.buildSubtask.findMany({ where: { ref: null }, orderBy: [{ itemId: 'asc' }, { order: 'asc' }], select: { id: true } })) {
        await assignBuildSubtaskRef(s.id).catch(() => {});
      }
    }
    // Dedupe: keep the oldest holder of a duplicated ref, re-assign the rest.
    const dupItems = await db.$queryRaw<{ ref: string }[]>`SELECT "ref" FROM "BuildItem" WHERE "ref" IS NOT NULL GROUP BY "ref" HAVING COUNT(*) > 1`;
    for (const { ref } of dupItems) {
      const rows = await db.buildItem.findMany({ where: { ref }, orderBy: { seq: 'asc' }, select: { id: true } });
      for (const r of rows.slice(1)) {
        await db.buildItem.update({ where: { id: r.id }, data: { ref: null } });
        await assignBuildItemRef(r.id).catch(() => {});
      }
    }
    const dupSubs = await db.$queryRaw<{ ref: string }[]>`SELECT "ref" FROM "BuildSubtask" WHERE "ref" IS NOT NULL GROUP BY "ref" HAVING COUNT(*) > 1`;
    for (const { ref } of dupSubs) {
      const rows = await db.buildSubtask.findMany({ where: { ref }, orderBy: { createdAt: 'asc' }, select: { id: true } });
      for (const r of rows.slice(1)) {
        await db.buildSubtask.update({ where: { id: r.id }, data: { ref: null } });
        await assignBuildSubtaskRef(r.id).catch(() => {});
      }
    }
    buildRefsChecked = true;
  } catch (e) {
    console.error('[task-refs] build backfill failed', e);
  }
}
