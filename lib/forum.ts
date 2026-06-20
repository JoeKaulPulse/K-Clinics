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
  return { ok: true };
}
