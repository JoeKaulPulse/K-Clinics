import 'server-only';
import { db } from '@/lib/db';
import type { BuildType, BuildStatus, BuildUrgency } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// Build & Issues board — server logic. Staff report problems / tasks; each
// change appends a BuildEvent (the live audit). Optionally bridges to GitHub
// issues so logged work can be actioned through the Claude↔GitHub flow.
// ─────────────────────────────────────────────────────────────────────────────

export type NewBuildItem = {
  type?: BuildType; title: string; detail?: string; urgency?: BuildUrgency;
  assignee?: string; reportedBy?: string; pageUrl?: string; screenshots?: string[];
  value?: number; effort?: number;
};

/** Idempotently import Claude's working backlog (deduped by title) so the board
 *  is the auditable record of work + decisions. Safe to run repeatedly. */
export async function seedBacklog(): Promise<{ created: number; skipped: number }> {
  const { BUILD_BACKLOG, vToE } = await import('@/lib/build-backlog');
  let created = 0, skipped = 0;
  for (const it of BUILD_BACKLOG) {
    const exists = await db.buildItem.findFirst({ where: { title: it.title }, select: { id: true } });
    if (exists) { skipped += 1; continue; }
    const ratio = vToE(it);
    const priority = ratio != null ? ` · value ${it.value}/effort ${it.effort} (V:E ${ratio})` : '';
    await db.buildItem.create({
      data: {
        title: it.title, type: it.type, urgency: it.urgency, status: it.status,
        assignee: it.assignee || 'claude', reportedBy: 'claude', detail: it.detail,
        value: it.value ?? null, effort: it.effort ?? null,
        githubUrl: it.pr || null, shippedAt: it.status === 'SHIPPED' ? new Date() : null,
        events: { create: [
          { kind: 'created', actor: 'claude', body: `Imported — ${it.type} · ${it.urgency} · ${it.status}${priority}${it.pr ? ` · ${it.pr}` : ''}` },
          ...(it.notes || []).map((n) => ({ kind: 'comment', actor: 'claude', body: n })),
        ] },
        subtasks: it.subtasks?.length ? { create: it.subtasks.map((s, i) => ({ title: s.title, ownerInput: !!s.ownerInput, assignee: s.assignee || 'claude', order: i + 1 })) } : undefined,
      },
    });
    created += 1;
  }
  return { created, skipped };
}

/** Wire declarative `dependsOn` (by title) from the backlog into BuildDependency
 *  edges, idempotently, then block any dependent whose prerequisites aren't done.
 *  This is what makes seeded dependency chains flow automatically. */
export async function wireBacklogDependencies(): Promise<void> {
  const { BUILD_BACKLOG } = await import('@/lib/build-backlog');
  const withDeps = BUILD_BACKLOG.filter((b) => b.dependsOn?.length);
  if (!withDeps.length) return;
  const titles = new Set<string>();
  withDeps.forEach((b) => { titles.add(b.title); b.dependsOn!.forEach((t) => titles.add(t)); });
  const rows = await db.buildItem.findMany({ where: { title: { in: [...titles] } }, select: { id: true, title: true, status: true } });
  const byTitle = new Map(rows.map((r) => [r.title, r]));
  for (const b of withDeps) {
    const item = byTitle.get(b.title);
    if (!item) continue;
    for (const depTitle of b.dependsOn!) {
      const dep = byTitle.get(depTitle);
      if (!dep || dep.id === item.id) continue;
      const exists = await db.buildDependency.findUnique({ where: { itemId_dependsOnId: { itemId: item.id, dependsOnId: dep.id } } }).catch(() => null);
      if (!exists) await db.buildDependency.create({ data: { itemId: item.id, dependsOnId: dep.id } }).catch(() => {});
    }
    // Park it BLOCKED if any prerequisite isn't done yet (forward-only, never touches terminal/in-flight human work).
    if (item.status === 'TRIAGE' && !(await depsMet(item.id))) {
      const openDeps = (await db.buildDependency.findMany({ where: { itemId: item.id }, include: { dependsOn: { select: { title: true, status: true } } } })).filter((d) => !DONE_STATES.includes(d.dependsOn.status)).map((d) => d.dependsOn.title);
      await db.buildItem.update({ where: { id: item.id }, data: { status: 'BLOCKED', blocker: `Waiting on: ${openDeps.join(', ')}`, events: { create: { kind: 'status', actor: 'claude', body: `→ BLOCKED (depends on ${openDeps.length} task${openDeps.length === 1 ? '' : 's'})` } } } }).catch(() => {});
    }
  }
}

async function stampSeeded(version: string) {
  const now = new Date().toISOString();
  await db.setting.upsert({ where: { key: 'backlog_seeded_version' }, update: { value: version, updatedBy: 'system' }, create: { key: 'backlog_seeded_version', value: version, updatedBy: 'system' } });
  await db.setting.upsert({ where: { key: 'backlog_seeded_at' }, update: { value: now, updatedBy: 'system' }, create: { key: 'backlog_seeded_at', value: now, updatedBy: 'system' } });
}

let backlogSeedChecked = false;
/** Keep the board in lock-step with the canonical backlog. Self-heals: re-seeds
 *  when the content-hash version changed OR the live item count is short of the
 *  backlog (so missing items can never silently persist), and ALWAYS reconciles
 *  statuses + owner assignments. Runs once per warm process on board load. */
export async function ensureBacklogSeeded(): Promise<void> {
  if (backlogSeedChecked) return; // already handled in this warm process
  backlogSeedChecked = true;
  try {
    const { BACKLOG_VERSION, BUILD_BACKLOG } = await import('@/lib/build-backlog');
    const [row, dbCount] = await Promise.all([
      db.setting.findUnique({ where: { key: 'backlog_seeded_version' } }),
      db.buildItem.count(),
    ]);
    if (row?.value !== BACKLOG_VERSION || dbCount < BUILD_BACKLOG.length) {
      await seedBacklog();
      await stampSeeded(BACKLOG_VERSION);
    }
    await assignOwnerInputTasks(); // idempotent; ensures blocked tasks have an owner + instructions
    await reconcileBacklog(); // advance shipped items so the board doesn't drift from the backlog
    await wireBacklogDependencies(); // idempotently wire declarative dependencies + block what's waiting
  } catch (e) {
    backlogSeedChecked = false; // transient failure — let a later request retry
    console.error('[build] auto-seed backlog failed', e);
  }
}

/** Force a full sync now (the board's "Rebuild from backlog" button) — create
 *  any missing items, reconcile statuses, reassign owner-input tasks, restamp. */
export async function rebuildBacklog(): Promise<{ created: number; skipped: number; reconciled: number }> {
  backlogSeedChecked = false;
  const { BACKLOG_VERSION } = await import('@/lib/build-backlog');
  const seed = await seedBacklog();
  await assignOwnerInputTasks();
  const rec = await reconcileBacklog();
  await wireBacklogDependencies();
  await stampSeeded(BACKLOG_VERSION);
  return { ...seed, reconciled: rec.updated };
}

/** What the board shows so the owner can SEE if it's current: the backlog
 *  version it's seeded at, item counts, when it last synced, and the running
 *  build commit (so a stale deploy is obvious at a glance). */
export async function backlogSyncState() {
  const { BACKLOG_VERSION, BUILD_BACKLOG } = await import('@/lib/build-backlog');
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local';
  try {
    const [verRow, atRow, dbCount] = await Promise.all([
      db.setting.findUnique({ where: { key: 'backlog_seeded_version' } }),
      db.setting.findUnique({ where: { key: 'backlog_seeded_at' } }),
      db.buildItem.count(),
    ]);
    return {
      inSync: verRow?.value === BACKLOG_VERSION && dbCount >= BUILD_BACKLOG.length,
      version: BACKLOG_VERSION, storedVersion: verRow?.value || null,
      dbCount, backlogCount: BUILD_BACKLOG.length, lastSeededAt: atRow?.value || null, commit,
    };
  } catch {
    return { inSync: false, version: BACKLOG_VERSION, storedVersion: null, dbCount: 0, backlogCount: BUILD_BACKLOG.length, lastSeededAt: null, commit };
  }
}

/** Pick the active user best placed to action an input-required task, from the
 *  live roster — by role for OWNER decisions, or the most senior practising
 *  clinician for treatment/pricing calls. Falls back sensibly if the ideal
 *  match isn't present. */
async function pickBestUser(needs: 'OWNER' | 'CLINICAL') {
  const users = await db.adminUser.findMany({
    where: { active: true },
    select: { email: true, name: true, role: true, isClinician: true, title: true },
  });
  if (!users.length) return null;
  const rank = (r: string) => ({ OWNER: 0, ADMIN: 1, PRACTITIONER: 2, FRONT_DESK: 3, STAFF: 4 } as Record<string, number>)[r] ?? 5;
  let pool = users;
  if (needs === 'CLINICAL') {
    const clinicians = users.filter((u) => u.isClinician);
    pool = clinicians.length ? clinicians : users; // no clinician on file → fall back to senior staff
  } else {
    const owners = users.filter((u) => u.role === 'OWNER');
    pool = owners.length ? owners : users;
  }
  return [...pool].sort((a, b) => rank(a.role) - rank(b.role))[0];
}

/** For every input-required backlog task, assign it to the best-placed real user
 *  and post the precise instruction of what's needed. Idempotent: skips items
 *  already assigned to a person, and never duplicates the instruction comment.
 *
 *  Crucially, it never *re-bounces* a task back to a human once they've responded:
 *  if the person has commented / changed status / handed it back to Claude since
 *  we last asked them, the input is treated as provided — Claude keeps it and (if
 *  it was BLOCKED) it's pulled into Claude's queue to action. This fixes the loop
 *  where a completed owner task, reassigned to Claude, was reassigned straight
 *  back to the owner on the next board load. */
export async function assignOwnerInputTasks(): Promise<void> {
  const { BUILD_BACKLOG } = await import('@/lib/build-backlog');
  const MARK = '📋 Action needed';
  const isHuman = (actor: string) => actor.includes('@'); // staff emails; 'claude'/'system' aren't
  for (const it of BUILD_BACKLOG) {
    if (!it.needs || !it.ask) continue;
    const item = await db.buildItem.findFirst({ where: { title: it.title }, include: { events: true } });
    if (!item) continue;

    // Has the human responded since we last asked them? Compare the newest human
    // touch (comment/status/assign/blocker) against the newest time Claude asked
    // (a claude-authored 'assign' to a person). If the human is newer — or they've
    // already engaged and Claude never asked — the input is in; don't bounce back.
    const ts = (e: { createdAt: Date }) => +new Date(e.createdAt);
    const lastClaudeAsk = Math.max(0, ...item.events.filter((e) => e.actor === 'claude' && e.kind === 'assign').map(ts));
    const lastHumanTouch = Math.max(0, ...item.events.filter((e) => isHuman(e.actor) && ['comment', 'status', 'assign', 'blocker'].includes(e.kind)).map(ts));
    const humanResponded = lastHumanTouch > 0 && lastHumanTouch >= lastClaudeAsk;

    if (humanResponded) {
      // The owner has acted. Keep it with whoever they handed it to; if it came
      // back to Claude and is still parked as BLOCKED, queue it for Claude to pick
      // up — Claude infers "I've got the answer, action it" rather than re-asking.
      if (item.assignee === 'claude' && item.status === 'BLOCKED') {
        await db.buildItem.update({
          where: { id: item.id },
          data: { status: 'TRIAGE', events: { create: { kind: 'status', actor: 'claude', body: 'BLOCKED → TRIAGE — owner responded; back with Claude to action.' } } },
        });
      }
      continue;
    }

    // Assign to the best-placed user if it's still unassigned / on Claude.
    if (!item.assignee || item.assignee === 'claude') {
      const user = await pickBestUser(it.needs);
      if (user) {
        const who = user.name ? `${user.name}${user.title ? ` (${user.title})` : ''}` : user.email;
        await db.buildItem.update({
          where: { id: item.id },
          data: { assignee: user.email, events: { create: { kind: 'assign', actor: 'claude', body: `Assigned to ${who} — best placed to action this (${it.needs.toLowerCase()} input).` } } },
        });
        const { notifyStaff } = await import('@/lib/notifications');
        await notifyStaff(user.email, { kind: 'assigned', title: `Action needed from you: ${item.title}`, body: it.ask, href: '/admin/build' });
      }
    }

    // Post the clear instruction once.
    if (!item.events.some((e) => e.kind === 'comment' && (e.body || '').startsWith(MARK))) {
      await db.buildEvent.create({ data: { itemId: item.id, kind: 'comment', actor: 'claude', body: `${MARK} — ${it.ask}` } });
    }
  }
}

/** Propagate canonical backlog status onto already-seeded board items. seedBacklog
 *  only ever *creates* (deduped by title), so when Claude ships a backlog task the
 *  board would otherwise stay stuck on its old status. This advances a seeded item
 *  to SHIPPED (terminal) when the backlog says so — forward-only, so it never
 *  clobbers a human moving a card — and records the change as an event. */
export async function reconcileBacklog(): Promise<{ updated: number }> {
  const { BUILD_BACKLOG } = await import('@/lib/build-backlog');
  let updated = 0;
  for (const it of BUILD_BACKLOG) {
    if (it.status !== 'SHIPPED') continue;
    const item = await db.buildItem.findFirst({ where: { title: it.title }, select: { id: true, status: true, githubUrl: true } });
    // Skip terminal states — never drag a human-closed (or cancelled) card back to SHIPPED.
    if (!item || ['SHIPPED', 'CLOSED', 'CANCELLED'].includes(item.status)) continue;
    await db.buildItem.update({
      where: { id: item.id },
      data: {
        status: 'SHIPPED', shippedAt: new Date(),
        githubUrl: item.githubUrl || it.pr || null,
        events: { create: { kind: 'status', actor: 'claude', body: `${item.status} → SHIPPED${it.pr ? ` · ${it.pr}` : ''} (synced from backlog)` } },
      },
    });
    await unblockDependents(item.id).catch(() => {}); // a shipped prerequisite frees its dependents
    updated += 1;
  }
  return { updated };
}

// Shared include so cards/modal always have events, subtasks and dependency edges
// (each side carries the other item's id/title/status for "blocked by / blocks").
const DEP_SELECT = { select: { id: true, title: true, status: true } } as const;
export const ITEM_INCLUDE = {
  events: { orderBy: { createdAt: 'desc' as const }, take: 30 },
  subtasks: { orderBy: { order: 'asc' as const } },
  dependencies: { include: { dependsOn: DEP_SELECT } },
  dependents: { include: { item: DEP_SELECT } },
};

export async function listBuildItems() {
  return db.buildItem.findMany({
    orderBy: [{ status: 'asc' }, { urgency: 'asc' }, { createdAt: 'desc' }],
    take: 300,
    include: ITEM_INCLUDE,
  });
}

const DONE_STATES = ['SHIPPED', 'CLOSED'];

/** Add a dependency edge (item depends on dependsOn). If the prerequisite isn't
 *  done yet, the dependent is parked as BLOCKED so it can't be worked early. */
export async function addDependency(itemId: string, dependsOnId: string, actor: string) {
  if (itemId === dependsOnId) return db.buildItem.findUnique({ where: { id: itemId }, include: ITEM_INCLUDE });
  const dep = await db.buildItem.findUnique({ where: { id: dependsOnId }, select: { title: true, status: true } });
  if (!dep) return db.buildItem.findUnique({ where: { id: itemId }, include: ITEM_INCLUDE });
  await db.buildDependency.upsert({ where: { itemId_dependsOnId: { itemId, dependsOnId } }, update: {}, create: { itemId, dependsOnId } }).catch(() => {});
  await db.buildEvent.create({ data: { itemId, kind: 'dependency', actor, body: `Blocked by “${dep.title}”` } }).catch(() => {});
  if (!DONE_STATES.includes(dep.status)) {
    const it = await db.buildItem.findUnique({ where: { id: itemId }, select: { status: true } });
    if (it && !DONE_STATES.includes(it.status) && it.status !== 'BLOCKED') {
      await db.buildItem.update({ where: { id: itemId }, data: { status: 'BLOCKED', blocker: `Waiting on “${dep.title}”`, events: { create: { kind: 'status', actor: 'claude', body: `→ BLOCKED (depends on “${dep.title}”)` } } } });
    }
  }
  return db.buildItem.findUnique({ where: { id: itemId }, include: ITEM_INCLUDE });
}

export async function removeDependency(itemId: string, dependsOnId: string, actor: string) {
  await db.buildDependency.deleteMany({ where: { itemId, dependsOnId } });
  await db.buildEvent.create({ data: { itemId, kind: 'dependency', actor, body: 'Dependency removed' } }).catch(() => {});
  await unblockIfReady(itemId); // removing the last open blocker may free it
  return db.buildItem.findUnique({ where: { id: itemId }, include: ITEM_INCLUDE });
}

/** True when every dependency of `itemId` has shipped/closed. */
async function depsMet(itemId: string): Promise<boolean> {
  const deps = await db.buildDependency.findMany({ where: { itemId }, include: { dependsOn: { select: { status: true } } } });
  return deps.every((d) => DONE_STATES.includes(d.dependsOn.status));
}

/** If a BLOCKED item's dependencies are now all met, advance it to TRIAGE and
 *  queue it for Claude — this is how dependency tasks automatically flow. */
async function unblockIfReady(itemId: string): Promise<boolean> {
  const it = await db.buildItem.findUnique({ where: { id: itemId }, select: { status: true } });
  if (!it || it.status !== 'BLOCKED') return false;
  if (!(await depsMet(itemId))) return false;
  await db.buildItem.update({ where: { id: itemId }, data: { status: 'TRIAGE', blocker: null, events: { create: { kind: 'status', actor: 'claude', body: 'BLOCKED → TRIAGE — all dependencies complete; ready to start.' } } } });
  await setRaw('build_continue_requested_at', new Date().toISOString());
  return true;
}

/** When `itemId` reaches a done state, re-evaluate everything that depends on it. */
export async function unblockDependents(itemId: string): Promise<void> {
  const edges = await db.buildDependency.findMany({ where: { dependsOnId: itemId }, select: { itemId: true } });
  for (const e of edges) await unblockIfReady(e.itemId).catch(() => {});
}

/** Recent Claude activity for the live ticker — newest first, across all items.
 *  Plus what's actively in progress with Claude (the "now" focus). */
export async function buildActivity(limit = 12) {
  const [events, inProgress, continueAt] = await Promise.all([
    db.buildEvent.findMany({
      where: { actor: 'claude', kind: { in: ['status', 'shipped', 'comment', 'github', 'subtask', 'closed'] } },
      orderBy: { createdAt: 'desc' }, take: limit,
      include: { item: { select: { id: true, title: true } } },
    }),
    db.buildItem.findMany({ where: { assignee: 'claude', status: 'IN_PROGRESS' }, select: { id: true, title: true }, orderBy: { updatedAt: 'desc' }, take: 5 }),
    db.setting.findUnique({ where: { key: 'build_continue_requested_at' } }).catch(() => null),
  ]);
  return {
    events: events.map((e) => ({ id: e.id, kind: e.kind, body: e.body, title: e.item?.title || '', itemId: e.itemId, createdAt: e.createdAt })),
    inProgress,
    continueRequestedAt: continueAt?.value || null,
  };
}

export async function createBuildItem(input: NewBuildItem, actor: string) {
  const type = input.type ?? 'TASK';
  const item = await db.buildItem.create({
    data: {
      type,
      title: input.title.slice(0, 200),
      detail: input.detail?.slice(0, 5000) || null,
      urgency: input.urgency ?? 'P2',
      assignee: input.assignee || 'claude',
      reportedBy: input.reportedBy || actor,
      pageUrl: input.pageUrl?.slice(0, 300) || null,
      screenshots: (input.screenshots || []).slice(0, 6),
      value: typeof input.value === 'number' ? Math.max(1, Math.min(10, Math.round(input.value))) : null,
      effort: typeof input.effort === 'number' ? Math.max(1, Math.min(10, Math.round(input.effort))) : null,
      events: { create: { kind: 'created', actor, body: `Reported as ${type} · ${input.urgency ?? 'P2'}` } },
    },
    include: { events: true, subtasks: true },
  });
  // The item lives on the board — that's the source of truth and it needs no
  // GitHub call to be tracked or actioned. Mirroring to a GitHub issue is opt-in
  // (default OFF) and only happens for notable items when not rate-limited — so
  // logging a bug/idea/task never competes for GitHub's API budget.
  const userReported = !!item.reportedBy && !['claude', 'system'].includes(item.reportedBy.toLowerCase());
  const notable = userReported || item.type === 'ERROR' || item.type === 'IDEA' || item.urgency === 'P0' || item.urgency === 'P1';
  if (notable && (await githubMirrorEnabled()) && !(await ghBackoffActive())) {
    await pushToGithub(item.id, 'system').catch(() => {});
  }
  // Tell the assignee they've got something (unless they assigned it to themselves).
  if (item.assignee && item.assignee !== 'claude') {
    const { notifyStaff } = await import('@/lib/notifications');
    await notifyStaff(item.assignee, { kind: 'assigned', title: `New ${item.type.toLowerCase()} assigned: ${item.title}`, href: '/admin/build' }, actor);
  }
  return item;
}

type Patch = {
  status?: BuildStatus; urgency?: BuildUrgency; assignee?: string; blocker?: string | null;
  value?: number | null; effort?: number | null; estCompleteAt?: string | null;
  estTokens?: number | null; actualTokens?: number | null;
};
const clampScore = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(1, Math.min(10, Math.round(n))) : null);
export async function updateBuildItem(id: string, patch: Patch, actor: string) {
  const prev = await db.buildItem.findUnique({ where: { id } });
  if (!prev) return null;
  const data: Record<string, unknown> = {};
  const events: { kind: string; body: string; actor: string }[] = [];
  if (patch.status && patch.status !== prev.status) {
    data.status = patch.status;
    if (patch.status === 'IN_PROGRESS' && !prev.startedAt) data.startedAt = new Date();
    if (patch.status === 'SHIPPED' && !prev.shippedAt) data.shippedAt = new Date();
    events.push({ kind: 'status', actor, body: `${prev.status} → ${patch.status}` });
  }
  if (patch.urgency && patch.urgency !== prev.urgency) { data.urgency = patch.urgency; events.push({ kind: 'urgency', actor, body: `${prev.urgency} → ${patch.urgency}` }); }
  if (patch.assignee && patch.assignee !== prev.assignee) { data.assignee = patch.assignee; events.push({ kind: 'assign', actor, body: `Assigned to ${patch.assignee}` }); }
  if (patch.blocker !== undefined) { data.blocker = patch.blocker; if (patch.blocker) events.push({ kind: 'blocker', actor, body: patch.blocker }); }
  if (patch.value !== undefined) { data.value = patch.value === null ? null : clampScore(patch.value); }
  if (patch.effort !== undefined) { data.effort = patch.effort === null ? null : clampScore(patch.effort); }
  if (patch.estCompleteAt !== undefined) {
    const d = patch.estCompleteAt ? new Date(patch.estCompleteAt) : null;
    data.estCompleteAt = d && !isNaN(+d) ? d : null;
    events.push({ kind: 'eta', actor, body: data.estCompleteAt ? `ETA set to ${(data.estCompleteAt as Date).toLocaleDateString('en-GB')}` : 'ETA cleared' });
  }
  if (patch.estTokens !== undefined) data.estTokens = patch.estTokens === null ? null : Math.max(0, Math.round(Number(patch.estTokens) || 0));
  if (patch.actualTokens !== undefined) { data.actualTokens = patch.actualTokens === null ? null : Math.max(0, Math.round(Number(patch.actualTokens) || 0)); if (data.actualTokens) events.push({ kind: 'tokens', actor, body: `Logged ~${Number(data.actualTokens).toLocaleString()} tokens` }); }
  if (Object.keys(data).length === 0) return prev;
  const updated = await db.buildItem.update({ where: { id }, data: { ...data, events: { create: events } }, include: ITEM_INCLUDE });
  // Dependency auto-flow: when this item reaches a done state, free anything that was waiting on it.
  if (patch.status && patch.status !== prev.status && DONE_STATES.includes(patch.status)) await unblockDependents(id).catch(() => {});
  // Notify: the new assignee on reassignment; the reporter when their item moves.
  const { notifyStaff } = await import('@/lib/notifications');
  if (patch.assignee && patch.assignee !== prev.assignee && patch.assignee !== 'claude') {
    await notifyStaff(patch.assignee, { kind: 'assigned', title: `Assigned to you: ${updated.title}`, href: '/admin/build' }, actor);
  }
  if (patch.status && patch.status !== prev.status && prev.reportedBy && prev.reportedBy !== 'claude') {
    await notifyStaff(prev.reportedBy, { kind: 'status', title: `“${updated.title}” → ${patch.status.toLowerCase().replace('_', ' ')}`, href: '/admin/build' }, actor);
  }
  return updated;
}

function mentionTokens(body: string): string[] {
  return Array.from(body.matchAll(/(?:^|\s)@([\w.+-]+@[\w.-]+|[\w.-]{2,})/g)).map((m) => m[1].toLowerCase());
}
/** Was Claude @-mentioned? (so a comment can nudge Claude to carry on). */
function mentionsClaude(body: string): boolean { return mentionTokens(body).includes('claude'); }

/** Resolve @mentions in a comment to active staff emails. Matches @email or
 *  @local-part or @name-token (case-insensitive) against the live roster. */
async function resolveMentions(body: string): Promise<string[]> {
  const tokens = mentionTokens(body);
  if (!tokens.length) return [];
  const users = await db.adminUser.findMany({ where: { active: true }, select: { email: true, name: true } });
  const hits = new Set<string>();
  for (const t of tokens) {
    for (const u of users) {
      const email = u.email.toLowerCase();
      const local = email.split('@')[0];
      const nameTokens = (u.name || '').toLowerCase().split(/\s+/).filter(Boolean);
      if (t === email || t === local || nameTokens.includes(t)) hits.add(u.email);
    }
  }
  return [...hits];
}

export async function addBuildComment(id: string, body: string, actor: string) {
  await db.buildEvent.create({ data: { itemId: id, kind: 'comment', body: body.slice(0, 2000), actor } });
  await db.buildItem.update({ where: { id }, data: { updatedAt: new Date() } });
  const item = await db.buildItem.findUnique({ where: { id }, include: ITEM_INCLUDE });
  // Feedback loop: ping the reporter and the assignee (whoever didn't write it),
  // plus anyone @-mentioned in the comment.
  if (item) {
    const { notifyStaff } = await import('@/lib/notifications');
    const kind = item.type === 'IDEA' ? 'idea_feedback' : 'comment';
    const snippet = body.slice(0, 90);
    const mentioned = await resolveMentions(body);
    for (const m of mentioned) {
      await notifyStaff(m, { kind: 'mention', title: `You were mentioned on “${item.title}”`, body: snippet, href: '/admin/build' }, actor);
    }
    const recipients = new Set([item.reportedBy, item.assignee].filter((r): r is string => !!r && r !== 'claude' && !mentioned.includes(r)));
    for (const r of recipients) {
      await notifyStaff(r, { kind, title: `New comment on “${item.title}”`, body: snippet, href: '/admin/build' }, actor);
    }
    // @claude nudges Claude to carry on with this item (and its dependents) —
    // recorded to the DB work queue, with an optional debounced GitHub wake.
    if (mentionsClaude(body)) await triggerClaude(`You were @-mentioned on “${item.title}”: "${snippet}"`, id).catch(() => {});
  }
  return item;
}

// ── Attachments (photos + videos) ────────────────────────────────────────────
export async function addAttachments(id: string, urls: string[], actor: string) {
  const clean = urls.filter((u) => typeof u === 'string' && /^https?:\/\//.test(u)).slice(0, 20);
  if (!clean.length) return db.buildItem.findUnique({ where: { id }, include: ITEM_INCLUDE });
  const item = await db.buildItem.findUnique({ where: { id }, select: { attachments: true } });
  if (!item) return null;
  const merged = Array.from(new Set([...item.attachments, ...clean])).slice(0, 40);
  await db.buildItem.update({ where: { id }, data: { attachments: merged, events: { create: { kind: 'attachment', actor, body: `Added ${clean.length} file${clean.length === 1 ? '' : 's'}` } } } });
  return db.buildItem.findUnique({ where: { id }, include: ITEM_INCLUDE });
}

export async function removeAttachment(id: string, url: string, actor: string) {
  const item = await db.buildItem.findUnique({ where: { id }, select: { attachments: true } });
  if (!item) return null;
  await db.buildItem.update({ where: { id }, data: { attachments: item.attachments.filter((u) => u !== url), events: { create: { kind: 'attachment', actor, body: 'Removed a file' } } } });
  return db.buildItem.findUnique({ where: { id }, include: ITEM_INCLUDE });
}

// ── Subtasks ─────────────────────────────────────────────────────────────────
const withDetail = ITEM_INCLUDE;

export async function addSubtask(itemId: string, title: string, opts: { assignee?: string; ownerInput?: boolean }, actor: string) {
  const t = title.trim().slice(0, 200);
  if (!t) return null;
  const last = await db.buildSubtask.findFirst({ where: { itemId }, orderBy: { order: 'desc' }, select: { order: true } });
  await db.buildSubtask.create({ data: { itemId, title: t, assignee: opts.assignee || 'claude', ownerInput: !!opts.ownerInput, order: (last?.order ?? 0) + 1 } });
  await db.buildEvent.create({ data: { itemId, kind: 'subtask', actor, body: `Added subtask “${t}”${opts.ownerInput ? ' (owner input)' : ''}` } });
  return db.buildItem.findUnique({ where: { id: itemId }, include: withDetail });
}

export async function updateSubtask(subtaskId: string, patch: { status?: string; title?: string; assignee?: string }, actor: string) {
  const sub = await db.buildSubtask.findUnique({ where: { id: subtaskId } });
  if (!sub) return null;
  const data: Record<string, unknown> = {};
  if (patch.title && patch.title.trim() && patch.title !== sub.title) data.title = patch.title.trim().slice(0, 200);
  if (patch.assignee && patch.assignee !== sub.assignee) data.assignee = patch.assignee;
  const completing = patch.status === 'DONE' && sub.status !== 'DONE';
  if (patch.status && ['TODO', 'DOING', 'DONE'].includes(patch.status) && patch.status !== sub.status) {
    data.status = patch.status;
    data.completedAt = completing ? new Date() : null;
    data.completedBy = completing ? actor : null;
  }
  if (Object.keys(data).length === 0) return db.buildItem.findUnique({ where: { id: sub.itemId }, include: withDetail });
  await db.buildSubtask.update({ where: { id: subtaskId }, data });

  if (completing) {
    const human = actor.includes('@');
    await db.buildEvent.create({ data: { itemId: sub.itemId, kind: 'subtask', actor, body: `Completed subtask “${sub.title}”` } });
    // Automated workflow: when a person completes an owner-input subtask, ping
    // Claude to follow up — queue the parent with Claude and fire the GitHub
    // trigger so the next Claude run picks it up.
    if (sub.ownerInput && human) {
      const parent = await db.buildItem.findUnique({ where: { id: sub.itemId }, select: { status: true, githubUrl: true } });
      await db.buildItem.update({
        where: { id: sub.itemId },
        data: {
          assignee: 'claude',
          ...(parent?.status === 'BLOCKED' ? { status: 'TRIAGE' } : {}),
          events: { create: { kind: 'status', actor: 'claude', body: `Owner completed “${sub.title}” — back with Claude to follow up.` } },
        },
      });
      await triggerClaude(`Owner completed a subtask on a board item — please follow up.`, sub.itemId).catch(() => {});
    }
  }
  return db.buildItem.findUnique({ where: { id: sub.itemId }, include: withDetail });
}

// ── Post-ship sign-off (admin only; enforced in the API) ─────────────────────
export async function signoffItem(id: string, actor: string) {
  const prev = await db.buildItem.findUnique({ where: { id } });
  if (!prev) return null;
  if (!['SHIPPED', 'IN_REVIEW'].includes(prev.status)) return prev; // only sign off shipped/in-review work
  const out = await db.buildItem.update({
    where: { id },
    data: { status: 'CLOSED', closedAt: new Date(), closedBy: actor, events: { create: { kind: 'closed', actor, body: `Signed off & closed by ${actor.split('@')[0]}` } } },
    include: withDetail,
  });
  await unblockDependents(id).catch(() => {}); // closing may free dependents
  return out;
}

export async function reopenItem(id: string, reason: string | undefined, actor: string) {
  const prev = await db.buildItem.findUnique({ where: { id } });
  if (!prev) return null;
  return db.buildItem.update({
    where: { id },
    data: { status: 'TRIAGE', assignee: 'claude', closedAt: null, closedBy: null, events: { create: { kind: 'status', actor, body: `Reopened${reason ? ` — ${reason.slice(0, 300)}` : ''} (back with Claude).` } } },
    include: withDetail,
  });
}

// ── GitHub bridge ────────────────────────────────────────────────────────────
// Config comes from env (GITHUB_TOKEN + GITHUB_REPO) or, for self-serve setup,
// from an encrypted connection saved in admin (provider 'github'; the PAT lives
// in tokens.access, the "owner/repo" in accountRef).
export async function getGithubConfig(): Promise<{ token: string; repo: string } | null> {
  const envToken = process.env.GITHUB_TOKEN, envRepo = process.env.GITHUB_REPO;
  if (envToken && envRepo) return { token: envToken, repo: envRepo };
  try {
    const { getConnection } = await import('@/lib/oauth-connections');
    const conn = await getConnection('github');
    if (conn?.tokens.access && conn.accountRef) return { token: conn.tokens.access, repo: conn.accountRef };
  } catch { /* not connected */ }
  return null;
}
export async function githubConfigured(): Promise<boolean> { return !!(await getGithubConfig()); }
export async function githubRepo(): Promise<string | null> { return (await getGithubConfig())?.repo ?? null; }

// ── GitHub usage governor ────────────────────────────────────────────────────
// The board is the source of truth and works fully without GitHub. GitHub is an
// OPTIONAL mirror/wake — off by default and rate-limit-aware — so the dashboard
// (comments, tasks, ideas, bugs, backlog) never gets throttled by issue spam.
const GH_WAKE_COOLDOWN_MS = 10 * 60 * 1000; // at most one Claude "wake" per 10 min

async function getRaw(key: string): Promise<string | null> {
  try { return (await db.setting.findUnique({ where: { key } }))?.value ?? null; } catch { return null; }
}
async function setRaw(key: string, value: string, by = 'system'): Promise<void> {
  await db.setting.upsert({ where: { key }, update: { value, updatedBy: by }, create: { key, value, updatedBy: by } }).catch(() => {});
}

/** Mirroring to GitHub issues is opt-in (default OFF). When off, nothing is ever
 *  auto-pushed — the board is entirely self-contained. */
export async function githubMirrorEnabled(): Promise<boolean> { return (await getRaw('github_mirror_enabled')) === 'true'; }
export async function setGithubMirror(on: boolean, by: string): Promise<void> { await setRaw('github_mirror_enabled', on ? 'true' : 'false', by); }

/** When GitHub rate-limited us, we park all writes until this timestamp. */
export async function githubBackoffUntil(): Promise<number> { const v = await getRaw('github_backoff_until'); return v ? Number(v) || 0 : 0; }
async function ghBackoffActive(): Promise<boolean> { return (await githubBackoffUntil()) > Date.now(); }

/** Inspect a GitHub response and arm/clear the backoff window from its rate-limit
 *  headers, so one 403/429 stops us hammering until the limit resets. */
async function noteGhResponse(res: Response): Promise<void> {
  try {
    const remaining = Number(res.headers.get('x-ratelimit-remaining'));
    const retryAfter = Number(res.headers.get('retry-after'));
    const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000;
    if (res.status === 429 || (res.status === 403 && (remaining === 0 || retryAfter > 0))) {
      const until = retryAfter > 0 ? Date.now() + retryAfter * 1000 : (reset > Date.now() ? reset : Date.now() + 15 * 60 * 1000);
      await setRaw('github_backoff_until', String(until));
    } else if (res.ok && (Number.isNaN(remaining) || remaining > 5)) {
      const cur = await githubBackoffUntil();
      if (cur) await setRaw('github_backoff_until', '0'); // recovered — clear stale backoff
    }
  } catch { /* best-effort */ }
}

/** Tidy whatever the user pasted into a clean "owner/name". Accepts a full
 *  GitHub URL, an SSH remote, a trailing .git, leading @, or extra whitespace. */
export function normalizeRepo(input: string): string {
  let s = (input || '').trim();
  s = s.replace(/^https?:\/\/(www\.)?github\.com\//i, '').replace(/^git@github\.com:/i, '');
  s = s.replace(/\.git$/i, '').replace(/^@/, '').replace(/\/+$/, '').trim();
  return s;
}
/** Strip common paste artefacts from a token (quotes, a leading "Bearer ", whitespace). */
function cleanToken(input: string): string {
  return (input || '').trim().replace(/^bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();
}

async function ghProbe(url: string, token: string): Promise<{ status: number; ok: boolean; message?: string } | null> {
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'kclinics-build-board', 'X-GitHub-Api-Version': '2022-11-28' }, redirect: 'follow' });
    const body = (await r.json().catch(() => ({}))) as { message?: string };
    return { status: r.status, ok: r.ok, message: body?.message };
  } catch { return null; }
}

/** Validate a token+repo against the GitHub API, then save it (encrypted). */
export async function connectGithub(tokenRaw: string, repoRaw: string): Promise<{ ok: boolean; error?: string; repo?: string; warning?: string }> {
  const repo = normalizeRepo(repoRaw);
  const token = cleanToken(tokenRaw);
  if (!token) return { ok: false, error: 'Paste your GitHub token.' };
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return { ok: false, error: `“${repo || repoRaw}” isn’t a valid repo — use owner/name, e.g. JoeKaulPulse/K-Clinics.` };

  // One probe only (the issues endpoint — the permission we use) to avoid adding
  // to any rate limit. If it returns 200 the token works → save.
  const probe = await ghProbe(`https://api.github.com/repos/${repo}/issues?per_page=1`, token);
  if (probe === null) return { ok: false, error: 'Could not reach GitHub — please try again.' };
  const { saveConnection } = await import('@/lib/oauth-connections');
  const rateLimited = probe.status === 403 && /rate limit/i.test(probe.message || '');
  if (probe.ok || rateLimited) {
    // A rate-limit 403 still proves the token authenticated (limits are per-user),
    // so the token is valid — save it; GitHub is just briefly throttling.
    await saveConnection('github', { access: token, expiresAt: null }, repo, repo);
    return { ok: true, repo, warning: rateLimited ? 'Connected — GitHub was briefly rate-limiting checks, but your token is valid. Pushing issues will work once the limit resets (a few minutes).' : undefined };
  }
  const detail = probe.message ? ` — GitHub: “${probe.message}”` : '';
  if (probe.status === 401) return { ok: false, error: `GitHub rejected the token (401)${detail}. Re-copy it exactly (no spaces or quotes) and check it hasn’t expired.` };
  if (probe.status === 403) return { ok: false, error: `Forbidden (403)${detail}. The token needs Issues: Read & write + Metadata: Read on ${repo}.` };
  if (probe.status === 404) return { ok: false, error: `Not found (404)${detail}. Confirm the repo is ${repo} and that the token has it selected.` };
  return { ok: false, error: `GitHub returned ${probe.status}${detail}.` };
}
export async function disconnectGithub() {
  const { disconnect } = await import('@/lib/oauth-connections');
  await disconnect('github');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Push every board item not yet linked to a GitHub issue, in small throttled
 *  batches so GitHub's secondary rate limit isn't tripped. Returns how many were
 *  synced this run and how many remain (click again for the rest). */
export async function syncAllToGithub(actor: string, max = 8): Promise<{ synced: number; remaining: number; stopped: boolean; backoff?: boolean }> {
  if (!(await getGithubConfig())) return { synced: 0, remaining: 0, stopped: true };
  if (await ghBackoffActive()) { const remaining = await db.buildItem.count({ where: { githubUrl: null } }); return { synced: 0, remaining, stopped: true, backoff: true }; }
  const items = await db.buildItem.findMany({ where: { githubUrl: null }, orderBy: [{ urgency: 'asc' }, { createdAt: 'asc' }], select: { id: true } });
  let synced = 0, stopped = false;
  for (const it of items) {
    if (synced >= max) break;
    const updated = await pushToGithub(it.id, actor);
    if (updated?.githubUrl) { synced += 1; await sleep(700); }
    else { stopped = true; break; } // push failed (likely rate-limited) — stop cleanly
  }
  const remaining = await db.buildItem.count({ where: { githubUrl: null } });
  return { synced, remaining, stopped };
}

export async function pushToGithub(id: string, actor: string) {
  const item = await db.buildItem.findUnique({ where: { id } });
  if (!item || item.githubUrl) return item; // already linked
  const cfg = await getGithubConfig();
  if (!cfg) return item;
  if (await ghBackoffActive()) return item; // rate-limited — skip, the item stays on the board
  const { token, repo } = cfg;
  const body = [
    item.detail || '',
    '', `**Type:** ${item.type} · **Urgency:** ${item.urgency}`,
    item.reportedBy ? `**Reported by:** ${item.reportedBy}` : '',
    item.pageUrl ? `**Page:** ${item.pageUrl}` : '',
    item.screenshots.length ? `\n**Screenshots:**\n${item.screenshots.map((s) => `![screenshot](${s})`).join('\n')}` : '',
    '', '_Logged from the K-Clinics Build & Issues board._',
  ].filter(Boolean).join('\n');
  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: `[${item.urgency}] ${item.title}`, body, labels: ['claude', item.type.toLowerCase()] }),
  });
  await noteGhResponse(res);
  if (!res.ok) return item;
  const issue = (await res.json()) as { html_url?: string; number?: number };
  return db.buildItem.update({
    where: { id },
    data: { githubUrl: issue.html_url || null, githubNumber: issue.number || null, events: { create: { kind: 'github', actor, body: `Created GitHub issue #${issue.number}` } } },
  });
}

// ── The work queue (DB-native) ───────────────────────────────────────────────
// Claude continues work by reading this queue from the dashboard — no GitHub
// round-trip required. Everything the team logs (tasks, ideas, bugs, comments,
// backlog) surfaces here in priority order.

const veRank = (i: { value: number | null; effort: number | null }) => (i.value && i.effort ? i.value / i.effort : 0);

/** What Claude should pick up next, straight from the board. Pure DB read. */
export async function pendingWork() {
  const open = await db.buildItem.findMany({
    where: { status: { in: ['TRIAGE', 'IN_PROGRESS', 'IN_REVIEW'] } },
    select: { id: true, title: true, type: true, urgency: true, status: true, assignee: true, value: true, effort: true, reportedBy: true, createdAt: true },
  });
  const mine = open.filter((i) => i.assignee === 'claude');
  const byPriority = (a: typeof open[number], b: typeof open[number]) => a.urgency.localeCompare(b.urgency) || veRank(b) - veRank(a) || +new Date(a.createdAt) - +new Date(b.createdAt);
  const [continueAt, lastWake] = await Promise.all([getRaw('build_continue_requested_at'), getRaw('build_continue_last_wake_at')]);
  return {
    continueRequestedAt: continueAt,
    lastWakeAt: lastWake,
    queue: [...mine].sort(byPriority).slice(0, 25),
    ideasToTriage: open.filter((i) => i.type === 'IDEA' && i.status === 'TRIAGE').sort(byPriority),
    openBugs: open.filter((i) => i.type === 'ERROR').sort(byPriority),
    counts: {
      withClaude: mine.length,
      ideas: open.filter((i) => i.type === 'IDEA').length,
      bugs: open.filter((i) => i.type === 'ERROR').length,
      awaitingSignoff: await db.buildItem.count({ where: { status: 'SHIPPED' } }),
    },
  };
}

// ── Optional, governed GitHub wake ───────────────────────────────────────────
// A Claude session is started by GitHub activity, so an @claude issue comment can
// wake one — but that's now a rare, debounced nudge (≤1 per cooldown, only when
// mirroring is on and we're not rate-limited). The request itself is always
// recorded in the DB queue above, so nothing depends on the GitHub call landing.

async function ghComment(issueNumber: number, body: string): Promise<boolean> {
  const cfg = await getGithubConfig();
  if (!cfg) return false;
  const res = await fetch(`https://api.github.com/repos/${cfg.repo}/issues/${issueNumber}/comments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
  await noteGhResponse(res);
  return res.ok;
}

/** Should we spend a GitHub call to wake Claude now? Only if mirroring is on, not
 *  backed off, and we haven't woken within the cooldown. */
async function canWakeViaGithub(): Promise<boolean> {
  if (!(await githubMirrorEnabled()) || (await ghBackoffActive()) || !(await getGithubConfig())) return false;
  const last = Number((await getRaw('build_continue_last_wake_at')) || 0);
  return Date.now() - last > GH_WAKE_COOLDOWN_MS;
}

// ── Preferred wake: Claude Code Routine (API trigger) ────────────────────────
// A routine fire starts an unattended Claude session directly — GitHub-free, so
// it never touches GitHub's rate limit. URL + token come from env (set in Vercel,
// never committed). Bounded by a timeout so a board action can't hang on it.
export function routineConfigured(): boolean {
  return !!(process.env.CLAUDE_ROUTINE_FIRE_URL && process.env.CLAUDE_ROUTINE_FIRE_TOKEN);
}
async function fireRoutine(text: string): Promise<{ ok: boolean; sessionUrl?: string; error?: string }> {
  const url = process.env.CLAUDE_ROUTINE_FIRE_URL;
  const token = process.env.CLAUDE_ROUTINE_FIRE_TOKEN;
  if (!url || !token) return { ok: false, error: 'not-configured' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'experimental-cc-routine-2026-04-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: text.slice(0, 60000) }),
      signal: ctrl.signal,
    });
    const j = (await res.json().catch(() => ({}))) as { claude_code_session_url?: string; error?: { message?: string } };
    if (!res.ok) return { ok: false, error: j?.error?.message || `routine returned ${res.status}` };
    return { ok: true, sessionUrl: j?.claude_code_session_url };
  } catch (e) {
    return { ok: false, error: (e as Error)?.name === 'AbortError' ? 'timed out' : ((e as Error)?.message || 'failed') };
  } finally {
    clearTimeout(timer);
  }
}

/** Record that a board item needs Claude's attention, then wake a session. DB-first:
 *  the request is always queued; the wake prefers the routine (GitHub-free) and
 *  falls back to the governed GitHub @claude comment only if no routine is set. */
export async function triggerClaude(message: string, itemId: string): Promise<boolean> {
  await setRaw('build_continue_requested_at', new Date().toISOString());
  const item = await db.buildItem.findUnique({ where: { id: itemId }, select: { title: true, githubNumber: true } });
  const text = `${message}${item ? `\n\nWork item: “${item.title}”.` : ''}\nContinue per the prioritised K-Clinics Build & Issues backlog.`;

  if (routineConfigured()) {
    await setRaw('build_continue_last_wake_at', String(Date.now()));
    const r = await fireRoutine(text);
    if (r.ok) {
      await db.buildEvent.create({ data: { itemId, kind: 'status', actor: 'claude', body: `Claude session started${r.sessionUrl ? ` — ${r.sessionUrl}` : ''}` } }).catch(() => {});
      if (r.sessionUrl) await setRaw('build_last_session_url', r.sessionUrl);
      return true;
    }
    return false;
  }

  // Fallback: governed GitHub @claude comment.
  if (!(await canWakeViaGithub())) return false;
  let it = await db.buildItem.findUnique({ where: { id: itemId } });
  if (!it) return false;
  if (!it.githubNumber) { it = (await pushToGithub(itemId, 'system')) || it; }
  if (!it.githubNumber) return false;
  await setRaw('build_continue_last_wake_at', String(Date.now()));
  return ghComment(it.githubNumber, `@claude ${message}\n\n_Triggered from the Build & Issues board._`);
}

/** The board's "▶ Continue working" button. Always records the request to the DB
 *  queue (never lost, never fails); a GitHub wake is a best-effort, debounced
 *  extra that's skipped when mirroring is off / rate-limited / within cooldown. */
export async function requestClaudeContinue(actor: string): Promise<{ ok: boolean; queued: boolean; woke: boolean; via: 'routine' | 'github' | 'queue'; mirror: boolean; sessionUrl?: string; githubUrl?: string; note?: string }> {
  const now = new Date().toISOString();
  await setRaw('build_continue_requested_at', now, actor);
  const mirror = await githubMirrorEnabled();

  // Preferred wake: fire the Claude Code Routine (GitHub-free, no rate limit).
  if (routineConfigured()) {
    await setRaw('build_continue_last_wake_at', String(Date.now()), actor);
    const r = await fireRoutine(`Continue working through the prioritised K-Clinics Build & Issues backlog (highest value-to-effort first; skip owner-gated items). Requested by ${actor.split('@')[0]} at ${now}.`);
    if (r.ok) {
      if (r.sessionUrl) await setRaw('build_last_session_url', r.sessionUrl, actor);
      return { ok: true, queued: true, woke: true, via: 'routine', mirror, sessionUrl: r.sessionUrl, note: 'Claude session started — it’s working the backlog now.' };
    }
    return { ok: true, queued: true, woke: false, via: 'queue', mirror, note: `Saved to the queue, but couldn’t auto-start a session (${r.error}). I’ll still pick it up; if this persists, re-check the routine token.` };
  }

  if (!(await canWakeViaGithub())) {
    const note = !mirror
      ? 'Saved to Claude’s work queue. (GitHub mirroring is off — Claude works straight from the dashboard.)'
      : (await ghBackoffActive())
        ? 'Saved to Claude’s work queue. GitHub is cooling down after heavy use, so no issue was created — Claude still picks it up from the board.'
        : 'Saved to Claude’s work queue — Claude will pick it up from the board on its next run.';
    return { ok: true, queued: true, woke: false, via: 'queue', mirror, note };
  }

  const cfg = (await getGithubConfig())!;
  const TITLE = '▶ Continue working through the backlog';
  const existing = Number((await getRaw('build_continue_issue_number')) || 0) || null;
  const msg = `@claude please continue working through the prioritised Build & Issues backlog (highest value-to-effort first, skipping owner-gated items). Requested by ${actor.split('@')[0]}.`;
  await setRaw('build_continue_last_wake_at', String(Date.now()), actor);

  if (existing) {
    const patch = await fetch(`https://api.github.com/repos/${cfg.repo}/issues/${existing}`, { method: 'PATCH', headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }, body: JSON.stringify({ state: 'open' }) }).catch(() => null);
    if (patch) await noteGhResponse(patch);
    const woke = await ghComment(existing, msg);
    return { ok: true, queued: true, woke, via: woke ? 'github' : 'queue', mirror, githubUrl: `https://github.com/${cfg.repo}/issues/${existing}`, note: woke ? 'Claude prompted via GitHub — a session will pick it up shortly.' : 'Saved to the queue (GitHub was busy) — Claude will still pick it up from the board.' };
  }

  const res = await fetch(`https://api.github.com/repos/${cfg.repo}/issues`, { method: 'POST', headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }, body: JSON.stringify({ title: TITLE, body: msg, labels: ['claude', 'continue'] }) });
  await noteGhResponse(res);
  if (!res.ok) return { ok: true, queued: true, woke: false, via: 'queue', mirror, note: 'Saved to the queue (GitHub was busy) — Claude will still pick it up from the board.' };
  const issue = (await res.json()) as { html_url?: string; number?: number };
  if (issue.number) await setRaw('build_continue_issue_number', String(issue.number), actor);
  return { ok: true, queued: true, woke: true, via: 'github', mirror, githubUrl: issue.html_url, note: 'Claude prompted via GitHub — a session will pick it up shortly.' };
}
