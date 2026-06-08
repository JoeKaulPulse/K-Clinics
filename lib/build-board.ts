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
  const { BUILD_BACKLOG } = await import('@/lib/build-backlog');
  let created = 0, skipped = 0;
  for (const it of BUILD_BACKLOG) {
    const exists = await db.buildItem.findFirst({ where: { title: it.title }, select: { id: true } });
    if (exists) { skipped += 1; continue; }
    await db.buildItem.create({
      data: {
        title: it.title, type: it.type, urgency: it.urgency, status: it.status,
        assignee: it.assignee || 'claude', reportedBy: 'claude', detail: it.detail,
        githubUrl: it.pr || null, shippedAt: it.status === 'SHIPPED' ? new Date() : null,
        events: { create: [
          { kind: 'created', actor: 'claude', body: `Imported — ${it.type} · ${it.urgency} · ${it.status}${it.pr ? ` · ${it.pr}` : ''}` },
          ...(it.notes || []).map((n) => ({ kind: 'comment', actor: 'claude', body: n })),
        ] },
      },
    });
    created += 1;
  }
  return { created, skipped };
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
  // Auto-bridge to GitHub when configured (so urgent items become actionable issues).
  if ((item.urgency === 'P0' || item.urgency === 'P1') && (await githubConfigured())) {
    await pushToGithub(item.id, 'system').catch(() => {});
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
  return db.buildItem.update({ where: { id }, data: { ...data, events: { create: events } }, include: { events: { orderBy: { createdAt: 'desc' }, take: 30 } } });
}

export async function addBuildComment(id: string, body: string, actor: string) {
  await db.buildEvent.create({ data: { itemId: id, kind: 'comment', body: body.slice(0, 2000), actor } });
  await db.buildItem.update({ where: { id }, data: { updatedAt: new Date() } });
  return db.buildItem.findUnique({ where: { id }, include: { events: { orderBy: { createdAt: 'desc' }, take: 30 } } });
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
