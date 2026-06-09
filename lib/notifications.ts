import 'server-only';
import { db, withDbRetry } from '@/lib/db';

// In-app notifications for staff/admin. Deliberately best-effort: a notification
// must never break the action that triggered it, so every write is guarded.

export type NotifyKind = 'assigned' | 'comment' | 'status' | 'idea_feedback' | 'mention' | 'system';

/** Notify a staff member by email. No-ops cleanly if the email isn't a known
 *  active user, or if the recipient is the actor (don't notify yourself). */
export async function notifyStaff(
  email: string | null | undefined,
  n: { kind: NotifyKind; title: string; body?: string; href?: string },
  actorEmail?: string,
): Promise<void> {
  try {
    const to = (email || '').trim().toLowerCase();
    if (!to || to === 'claude' || to === 'system') return;
    if (actorEmail && to === actorEmail.trim().toLowerCase()) return; // don't notify your own action
    const user = await db.adminUser.findUnique({ where: { email: to }, select: { id: true, active: true } });
    if (!user || !user.active) return;
    await db.staffNotification.create({
      data: { userId: user.id, kind: n.kind, title: n.title.slice(0, 200), body: n.body?.slice(0, 1000) || null, href: n.href?.slice(0, 300) || null },
    });
  } catch (e) {
    console.error('[notifications] create failed (non-fatal)', (e as Error)?.message);
  }
}

export async function unreadCount(userId: string): Promise<number> {
  try { return await withDbRetry(() => db.staffNotification.count({ where: { userId, readAt: null } }), 2); }
  catch { return 0; }
}

export async function listNotifications(userId: string, take = 20) {
  return withDbRetry(() => db.staffNotification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take }), 2).catch(() => []);
}

export async function markRead(userId: string, ids?: string[]): Promise<void> {
  await db.staffNotification.updateMany({
    where: { userId, readAt: null, ...(ids && ids.length ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  }).catch(() => {});
}
