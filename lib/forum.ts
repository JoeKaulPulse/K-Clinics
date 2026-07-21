import 'server-only';
import { db } from '@/lib/db';
import { currentTenantId } from '@/lib/tenant';

// ── BLD-533: trainee community forum ─────────────────────────────────────────
// A discussion space across the whole academy, separate from the per-lesson Q&A
// (LessonComment). Threads are grouped by a small fixed set of categories.

export const FORUM_CATEGORIES = [
  { key: 'general', label: 'General' },
  { key: 'study', label: 'Study help' },
  { key: 'showcase', label: 'Show your work' },
  { key: 'wellbeing', label: 'Wellbeing' },
  { key: 'announcements', label: 'Announcements' },
] as const;
export type ForumCategory = (typeof FORUM_CATEGORIES)[number]['key'];
const CATEGORY_KEYS = new Set<string>(FORUM_CATEGORIES.map((c) => c.key));
export const categoryLabel = (key: string): string => FORUM_CATEGORIES.find((c) => c.key === key)?.label ?? 'General';

type NameParts = { firstName: string | null; lastName: string | null };
const studentName = (s: NameParts | null): string => [s?.firstName, s?.lastName?.slice(0, 1)].filter(Boolean).join(' ') || 'Trainee';

export type ThreadSummary = {
  id: string; category: string; title: string; authorName: string; isStaff: boolean;
  pinned: boolean; locked: boolean; replyCount: number; lastPostAt: string; createdAt: string; excerpt: string;
};
export type ThreadPost = { id: string; authorName: string; isStaff: boolean; body: string; createdAt: string; mine: boolean };
export type ThreadDetail = {
  id: string; category: string; title: string; body: string; authorName: string; isStaff: boolean;
  pinned: boolean; locked: boolean; createdAt: string; mine: boolean; posts: ThreadPost[];
};

const toSummary = (t: { id: string; category: string; title: string; body: string; authorName: string; isStaff: boolean; pinned: boolean; locked: boolean; postCount: number; lastPostAt: Date; createdAt: Date }): ThreadSummary => ({
  id: t.id, category: t.category, title: t.title, authorName: t.authorName, isStaff: t.isStaff,
  pinned: t.pinned, locked: t.locked, replyCount: t.postCount, lastPostAt: t.lastPostAt.toISOString(), createdAt: t.createdAt.toISOString(),
  excerpt: t.body.replace(/\s+/g, ' ').trim().slice(0, 160),
});

/** Visible threads for the community board, newest activity first (pinned on top). */
export async function listThreads(category?: string): Promise<ThreadSummary[]> {
  const rows = await db.forumThread.findMany({
    where: { hidden: false, ...(category && CATEGORY_KEYS.has(category) ? { category } : {}) },
    orderBy: [{ pinned: 'desc' }, { lastPostAt: 'desc' }],
    take: 120,
    select: { id: true, category: true, title: true, body: true, authorName: true, isStaff: true, pinned: true, locked: true, postCount: true, lastPostAt: true, createdAt: true },
  });
  return rows.map(toSummary);
}

/** A single visible thread with its visible replies. */
export async function getThread(threadId: string, viewerId?: string): Promise<ThreadDetail | null> {
  const t = await db.forumThread.findFirst({
    where: { id: threadId, hidden: false },
    include: { posts: { where: { hidden: false }, orderBy: { createdAt: 'asc' }, take: 500 } },
  });
  if (!t) return null;
  return {
    id: t.id, category: t.category, title: t.title, body: t.body, authorName: t.authorName, isStaff: t.isStaff,
    pinned: t.pinned, locked: t.locked, createdAt: t.createdAt.toISOString(), mine: !!viewerId && t.authorStudentId === viewerId,
    posts: t.posts.map((p) => ({ id: p.id, authorName: p.authorName, isStaff: p.isStaff, body: p.body, createdAt: p.createdAt.toISOString(), mine: !!viewerId && p.authorStudentId === viewerId })),
  };
}

/** A trainee opens a new thread. Students can't post into the staff-only
 *  Announcements category (it falls back to General). */
export async function createThread(student: { id: string } & NameParts, input: { category: string; title: string; body: string }): Promise<{ ok: boolean; id?: string; error?: string }> {
  const title = (input.title ?? '').trim();
  const body = (input.body ?? '').trim();
  if (title.length < 4) return { ok: false, error: 'Give your post a title (at least 4 characters).' };
  if (body.length < 2) return { ok: false, error: 'Write a message.' };
  const category = CATEGORY_KEYS.has(input.category) && input.category !== 'announcements' ? input.category : 'general';
  const tenantId = await currentTenantId();
  const t = await db.forumThread.create({
    data: { tenantId, category, title: title.slice(0, 160), body: body.slice(0, 8000), authorStudentId: student.id, authorName: studentName(student), isStaff: false },
  });
  return { ok: true, id: t.id };
}

/** A trainee replies to a thread. */
export async function replyToThread(student: { id: string } & NameParts, threadId: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const text = (body ?? '').trim();
  if (!text) return { ok: false, error: 'Write a reply.' };
  const thread = await db.forumThread.findFirst({ where: { id: threadId, hidden: false }, select: { id: true, locked: true } });
  if (!thread) return { ok: false, error: 'Thread not found.' };
  if (thread.locked) return { ok: false, error: 'This thread is locked — no new replies.' };
  const tenantId = await currentTenantId();
  await db.forumPost.create({ data: { tenantId, threadId, authorStudentId: student.id, authorName: studentName(student), isStaff: false, body: text.slice(0, 8000) } });
  await db.forumThread.update({ where: { id: threadId }, data: { postCount: { increment: 1 }, lastPostAt: new Date() } }).catch(() => {});
  notifyForumReply(threadId, student.id, studentName(student), text).catch(() => {}); // BLD-537, fire-and-forget
  return { ok: true };
}

// ── Admin / moderation ───────────────────────────────────────────────────────

export type AdminPost = { id: string; authorName: string; isStaff: boolean; body: string; hidden: boolean; createdAt: string };
export type AdminThread = {
  id: string; category: string; title: string; body: string; authorName: string; isStaff: boolean;
  pinned: boolean; locked: boolean; hidden: boolean; replyCount: number; lastPostAt: string; createdAt: string; posts: AdminPost[];
};

/** Every thread (including hidden) with its posts, for the moderation board. */
export async function adminListThreads(): Promise<AdminThread[]> {
  const rows = await db.forumThread.findMany({
    orderBy: [{ pinned: 'desc' }, { lastPostAt: 'desc' }],
    take: 300,
    include: { posts: { orderBy: { createdAt: 'asc' }, take: 500 } },
  });
  return rows.map((t) => ({
    id: t.id, category: t.category, title: t.title, body: t.body, authorName: t.authorName, isStaff: t.isStaff,
    pinned: t.pinned, locked: t.locked, hidden: t.hidden, replyCount: t.postCount, lastPostAt: t.lastPostAt.toISOString(), createdAt: t.createdAt.toISOString(),
    posts: t.posts.map((p) => ({ id: p.id, authorName: p.authorName, isStaff: p.isStaff, body: p.body, hidden: p.hidden, createdAt: p.createdAt.toISOString() })),
  }));
}

/** Staff opens a thread (any category, including Announcements). */
export async function staffCreateThread(staff: { email: string; name: string }, input: { category: string; title: string; body: string }): Promise<{ ok: boolean; id?: string; error?: string }> {
  const title = (input.title ?? '').trim();
  const body = (input.body ?? '').trim();
  if (title.length < 4) return { ok: false, error: 'Title too short.' };
  if (!body) return { ok: false, error: 'Write a message.' };
  const category = CATEGORY_KEYS.has(input.category) ? input.category : 'announcements';
  const tenantId = await currentTenantId();
  const t = await db.forumThread.create({
    data: { tenantId, category, title: title.slice(0, 160), body: body.slice(0, 8000), authorStaff: staff.email, authorName: staff.name || 'K Academy team', isStaff: true },
  });
  return { ok: true, id: t.id };
}

/** Staff replies into a thread (also bumps activity; ignores the locked flag). */
export async function staffReply(staff: { email: string; name: string }, threadId: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const text = (body ?? '').trim();
  if (!text) return { ok: false, error: 'Write a reply.' };
  const thread = await db.forumThread.findUnique({ where: { id: threadId }, select: { id: true } });
  if (!thread) return { ok: false, error: 'Thread not found.' };
  const tenantId = await currentTenantId();
  await db.forumPost.create({ data: { tenantId, threadId, authorStaff: staff.email, authorName: staff.name || 'K Academy team', isStaff: true, body: text.slice(0, 8000) } });
  await db.forumThread.update({ where: { id: threadId }, data: { postCount: { increment: 1 }, lastPostAt: new Date() } }).catch(() => {});
  notifyForumReply(threadId, null, staff.name || 'K Academy', text).catch(() => {}); // BLD-537, fire-and-forget
  return { ok: true };
}

// ── BLD-537: notifications + digest ──────────────────────────────────────────

const SITE = () => process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://kclinics.co.uk';

/** Email the thread's author + distinct prior trainee participants (except the
 *  person who just posted) that there's a new reply. Best-effort. */
export async function notifyForumReply(threadId: string, actorStudentId: string | null, replierName: string, snippet: string): Promise<void> {
  const thread = await db.forumThread.findUnique({ where: { id: threadId }, select: { id: true, title: true, hidden: true, authorStudentId: true } });
  if (!thread || thread.hidden) return;
  const posts = await db.forumPost.findMany({ where: { threadId, authorStudentId: { not: null } }, select: { authorStudentId: true }, take: 500 });
  const ids = new Set<string>();
  if (thread.authorStudentId) ids.add(thread.authorStudentId);
  for (const p of posts) if (p.authorStudentId) ids.add(p.authorStudentId);
  if (actorStudentId) ids.delete(actorStudentId);
  if (ids.size === 0) return;

  const recipients = await db.academyStudent.findMany({ where: { id: { in: [...ids].slice(0, 60) }, portalActive: true }, select: { email: true, firstName: true } });
  if (recipients.length === 0) return;

  const { escapeHtml } = await import('@/lib/sanitize');
  const { sendEmail, emailShell } = await import('@/lib/email');
  const url = `${SITE()}/academy/community/${threadId}`;
  const preview = escapeHtml(snippet.replace(/\s+/g, ' ').trim().slice(0, 160));
  await Promise.all(recipients.map((r) => r.email ? sendEmail({
    to: r.email,
    subject: `New reply — ${thread.title}`,
    html: emailShell({
      preheader: `${replierName} replied in the K Academy community.`,
      body: `<h1 style="font-size:22px;margin:0 0 14px;">New reply in the community</h1>
        <p style="margin:0 0 12px;">Hi ${escapeHtml(r.firstName || 'there')},</p>
        <p style="margin:0 0 12px;"><strong>${escapeHtml(replierName)}</strong> replied to <strong>${escapeHtml(thread.title)}</strong>:</p>
        <p style="margin:0 0 16px;padding:12px 16px;background:#f7f1e8;border-radius:10px;color:#2a2420;">“${preview}”</p>
        <p style="margin:0 0 22px;"><a class="kc-btn" href="${url}" style="display:inline-block;background:#2a2420;color:#f7f1e8;text-decoration:none;padding:13px 26px;border-radius:999px;font-weight:600;">View the discussion &rarr;</a></p>
        <p style="margin:0;color:#8a7e72;font-size:13px;">You’re getting this because you posted in this thread.</p>`,
    }),
  }).catch(() => undefined) : Promise.resolve()));
}

/** Daily staff digest of community activity in the last 24h. Best-effort; only
 *  sends when there's something to report. Called from the daily cron. */
export async function sendCommunityDigest(): Promise<{ sent: boolean; threads: number; posts: number }> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [newThreads, newPosts, unanswered] = await Promise.all([
    db.forumThread.findMany({ where: { hidden: false, createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, title: true, category: true, authorName: true } }),
    db.forumPost.count({ where: { hidden: false, createdAt: { gte: since } } }),
    db.forumThread.findMany({ where: { hidden: false, isStaff: false, postCount: 0, createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, title: true } }),
  ]);
  if (newThreads.length === 0 && newPosts === 0) return { sent: false, threads: 0, posts: newPosts };

  const { site } = await import('@/lib/site');
  const to = process.env.CLINIC_NOTIFY_EMAIL || site.email;
  const { escapeHtml } = await import('@/lib/sanitize');
  const { sendEmail, emailShell } = await import('@/lib/email');
  const base = SITE();
  const list = (rows: { id: string; title: string }[]) => rows.map((t) => `<li style="margin:0 0 6px;"><a href="${base}/admin/academy/community" style="color:#2a2420;">${escapeHtml(t.title)}</a></li>`).join('');
  await sendEmail({
    to,
    subject: `K Academy community — ${newThreads.length} new thread${newThreads.length === 1 ? '' : 's'}, ${newPosts} repl${newPosts === 1 ? 'y' : 'ies'} (24h)`,
    html: emailShell({
      preheader: 'Daily community activity digest.',
      body: `<h1 style="font-size:22px;margin:0 0 14px;">Community activity — last 24 hours</h1>
        <p style="margin:0 0 12px;"><strong>${newThreads.length}</strong> new thread${newThreads.length === 1 ? '' : 's'} · <strong>${newPosts}</strong> new repl${newPosts === 1 ? 'y' : 'ies'}.</p>
        ${unanswered.length > 0 ? `<p style="margin:16px 0 6px;font-weight:600;">Awaiting a first reply (${unanswered.length}):</p><ul style="margin:0 0 12px;padding-left:18px;">${list(unanswered)}</ul>` : ''}
        ${newThreads.length > 0 ? `<p style="margin:16px 0 6px;font-weight:600;">New threads:</p><ul style="margin:0 0 12px;padding-left:18px;">${list(newThreads)}</ul>` : ''}
        <p style="margin:16px 0 0;"><a class="kc-btn" href="${base}/admin/academy/community" style="display:inline-block;background:#2a2420;color:#f7f1e8;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:600;">Open moderation &rarr;</a></p>`,
    }),
  }).catch(() => undefined);
  return { sent: true, threads: newThreads.length, posts: newPosts };
}
