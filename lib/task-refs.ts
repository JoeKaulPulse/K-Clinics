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
// Root numbers come from a Postgres sequence (`seq Int @default(autoincrement())`)
// so allocation is race-free with no app-side locking. Child numbers are derived
// from existing sibling refs (max suffix + 1) and guarded by the `@unique`
// constraint on `ref` — callers retry on the rare concurrent collision.
//
// Cite these refs in commits, PRs, audit findings and reports so work is
// traceable end-to-end (board → code → deploy).
// ─────────────────────────────────────────────────────────────────────────────

export const TASK_REF_PREFIX = 'TSK';
export const BUILD_REF_PREFIX = 'BLD';
export const PROJECT_REF_PREFIX = 'PRJ';

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

const isUniqueViolation = (e: unknown) => (e as { code?: string })?.code === 'P2002';

// ── Internal Tasks board ─────────────────────────────────────────────────────

/** Assign `ref` to a freshly created task: TSK-<seq> for top-level tasks, or the
 *  next branch of the parent's ref for sub-tasks. Retries on the (rare) ref
 *  collision from two concurrent sub-task creations under one parent. */
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

  for (let attempt = 0; attempt < 5; attempt++) {
    const siblings = await db.task.findMany({ where: { parentId: task.parentId }, select: { ref: true } });
    const ref = `${parentRef}.${nextChildSuffix(parentRef, siblings.map((s) => s.ref)) + attempt}`;
    try {
      await db.task.update({ where: { id: taskId }, data: { ref } });
      return ref;
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
    }
  }
  return null;
}

let taskRefsChecked = false;
/** Backfill refs for tasks created before the scheme existed. Parents first so
 *  sub-tasks always have a parent ref to branch from. Idempotent + memoised per
 *  warm process (new tasks get a ref at creation, so once clean, stays clean). */
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
    taskRefsChecked = true;
  } catch (e) {
    console.error('[task-refs] task backfill failed', e);
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
    const projectRef = await assignProjectRef(item.projectId);
    if (projectRef) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const siblings = await db.buildItem.findMany({ where: { projectId: item.projectId }, select: { ref: true } });
        const ref = `${projectRef}.${nextChildSuffix(projectRef, siblings.map((s) => s.ref)) + attempt}`;
        try {
          await db.buildItem.update({ where: { id: itemId }, data: { ref } });
          return ref;
        } catch (e) {
          if (!isUniqueViolation(e)) throw e;
        }
      }
      return null;
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
  for (let attempt = 0; attempt < 5; attempt++) {
    const siblings = await db.buildSubtask.findMany({ where: { itemId: sub.itemId }, select: { ref: true } });
    const ref = `${itemRef}.${nextChildSuffix(itemRef, siblings.map((s) => s.ref)) + attempt}`;
    try {
      await db.buildSubtask.update({ where: { id: subtaskId }, data: { ref } });
      return ref;
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
    }
  }
  return null;
}

let buildRefsChecked = false;
/** Backfill refs across the Build board: projects → items → subtasks, oldest
 *  first, so grouped work numbers in creation order and branches always have a
 *  root. Runs after project links are synced (see ensureBacklogSeeded) so
 *  pre-existing project members get PRJ-branch refs. Idempotent + memoised;
 *  pass force=true after seeding new items (the memo would otherwise skip them). */
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
    buildRefsChecked = true;
  } catch (e) {
    console.error('[task-refs] build backfill failed', e);
  }
}
