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
        githubUrl: it.pr || null, shippedAt: it.status === 'SHIPPED' ? new Date() : null,
        events: { create: [
          { kind: 'created', actor: 'claude', body: `Imported — ${it.type} · ${it.urgency} · ${it.status}${priority}${it.pr ? ` · ${it.pr}` : ''}` },
          ...(it.notes || []).map((n) => ({ kind: 'comment', actor: 'claude', body: n })),
        ] },
      },
    });
    created += 1;
  }
  return { created, skipped };
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
    if (!item || item.status === 'SHIPPED') continue;
    await db.buildItem.update({
      where: { id: item.id },
      data: {
        status: 'SHIPPED', shippedAt: new Date(),
        githubUrl: item.githubUrl || it.pr || null,
        events: { create: { kind: 'status', actor: 'claude', body: `${item.status} → SHIPPED${it.pr ? ` · ${it.pr}` : ''} (synced from backlog)` } },
      },
    });
    updated += 1;
  }
  return { updated };
}

export async function listBuildItems() {
  return db.buildItem.findMany({
    orderBy: [{ status: 'asc' }, { urgency: 'asc' }, { createdAt: 'desc' }],
    take: 300,
    include: { events: { orderBy: { createdAt: 'desc' }, take: 30 } },
  });
}

export async function createBuildItem(input: NewBuildItem, actor: string) {
  const item = await db.buildItem.create({
    data: {
      type: input.type ?? 'TASK',
      title: input.title.slice(0, 200),
      detail: input.detail?.slice(0, 5000) || null,
      urgency: input.urgency ?? 'P2',
      assignee: input.assignee || 'claude',
      reportedBy: input.reportedBy || actor,
      pageUrl: input.pageUrl?.slice(0, 300) || null,
      screenshots: (input.screenshots || []).slice(0, 6),
      events: { create: { kind: 'created', actor, body: `Reported as ${input.type ?? 'TASK'} · ${input.urgency ?? 'P2'}` } },
    },
    include: { events: true },
  });
  // Auto-bridge to GitHub the moment it's logged — so it's tracked and can
  // trigger Claude — for anything a person reports (a real reporter, not Claude/
  // system), any ERROR/bug, or anything urgent (P0/P1). Quieter Claude-authored
  // P2/P3 tasks still batch-sync via the cron to respect GitHub's rate limit.
  const userReported = !!item.reportedBy && !['claude', 'system'].includes(item.reportedBy.toLowerCase());
  const shouldSync = userReported || item.type === 'ERROR' || item.urgency === 'P0' || item.urgency === 'P1';
  if (shouldSync && (await githubConfigured())) {
    await pushToGithub(item.id, 'system').catch(() => {});
  }
  // Tell the assignee they've got something (unless they assigned it to themselves).
  if (item.assignee && item.assignee !== 'claude') {
    const { notifyStaff } = await import('@/lib/notifications');
    await notifyStaff(item.assignee, { kind: 'assigned', title: `New ${item.type.toLowerCase()} assigned: ${item.title}`, href: '/admin/build' }, actor);
  }
  return item;
}

type Patch = { status?: BuildStatus; urgency?: BuildUrgency; assignee?: string; blocker?: string | null };
export async function updateBuildItem(id: string, patch: Patch, actor: string) {
  const prev = await db.buildItem.findUnique({ where: { id } });
  if (!prev) return null;
  const data: Record<string, unknown> = {};
  const events: { kind: string; body: string; actor: string }[] = [];
  if (patch.status && patch.status !== prev.status) {
    data.status = patch.status;
    if (patch.status === 'SHIPPED') data.shippedAt = new Date();
    events.push({ kind: 'status', actor, body: `${prev.status} → ${patch.status}` });
  }
  if (patch.urgency && patch.urgency !== prev.urgency) { data.urgency = patch.urgency; events.push({ kind: 'urgency', actor, body: `${prev.urgency} → ${patch.urgency}` }); }
  if (patch.assignee && patch.assignee !== prev.assignee) { data.assignee = patch.assignee; events.push({ kind: 'assign', actor, body: `Assigned to ${patch.assignee}` }); }
  if (patch.blocker !== undefined) { data.blocker = patch.blocker; if (patch.blocker) events.push({ kind: 'blocker', actor, body: patch.blocker }); }
  if (Object.keys(data).length === 0) return prev;
  const updated = await db.buildItem.update({ where: { id }, data: { ...data, events: { create: events } }, include: { events: { orderBy: { createdAt: 'desc' }, take: 30 } } });
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

export async function addBuildComment(id: string, body: string, actor: string) {
  await db.buildEvent.create({ data: { itemId: id, kind: 'comment', body: body.slice(0, 2000), actor } });
  await db.buildItem.update({ where: { id }, data: { updatedAt: new Date() } });
  const item = await db.buildItem.findUnique({ where: { id }, include: { events: { orderBy: { createdAt: 'desc' }, take: 30 } } });
  // Feedback loop: ping the reporter and the assignee (whoever didn't write it).
  if (item) {
    const { notifyStaff } = await import('@/lib/notifications');
    const kind = item.type === 'IDEA' ? 'idea_feedback' : 'comment';
    const snippet = body.slice(0, 90);
    const recipients = new Set([item.reportedBy, item.assignee].filter((r): r is string => !!r && r !== 'claude'));
    for (const r of recipients) {
      await notifyStaff(r, { kind, title: `New comment on “${item.title}”`, body: snippet, href: '/admin/build' }, actor);
    }
  }
  return item;
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
export async function syncAllToGithub(actor: string, max = 8): Promise<{ synced: number; remaining: number; stopped: boolean }> {
  if (!(await getGithubConfig())) return { synced: 0, remaining: 0, stopped: true };
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
  if (!res.ok) return item;
  const issue = (await res.json()) as { html_url?: string; number?: number };
  return db.buildItem.update({
    where: { id },
    data: { githubUrl: issue.html_url || null, githubNumber: issue.number || null, events: { create: { kind: 'github', actor, body: `Created GitHub issue #${issue.number}` } } },
  });
}
