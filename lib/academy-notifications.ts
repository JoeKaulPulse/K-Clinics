import 'server-only';
import { db, withDbRetry } from '@/lib/db';

// BLD-1620: in-app notifications for academy students. Deliberately minimal —
// no categories/preferences/push, unlike lib/notifications.ts (staff) — a
// student's homework feedback is the only event source today. A notification
// must never break the action that triggered it, so every write is guarded.

export type StudentNotifyKind = 'homework_reviewed' | 'homework_needs_revision' | 'homework_approved';

export type StudentNotifyInput = { kind: StudentNotifyKind; title: string; body?: string | null; href?: string | null };

export async function notifyStudent(studentId: string, n: StudentNotifyInput): Promise<void> {
  try {
    await db.academyNotification.create({ data: { studentId, kind: n.kind, title: n.title, body: n.body ?? null, href: n.href ?? null } });
  } catch (e) {
    console.error('[academy-notifications] create failed (non-fatal)', (e as Error)?.message);
  }
}

export async function unreadCount(studentId: string): Promise<number> {
  try { return await withDbRetry(() => db.academyNotification.count({ where: { studentId, readAt: null } }), 2); }
  catch { return 0; }
}

export async function listNotifications(studentId: string, take = 20) {
  return withDbRetry(
    () => db.academyNotification.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' }, take }),
    2,
  ).catch(() => []);
}

export async function markRead(studentId: string, ids?: string[]): Promise<void> {
  await db.academyNotification.updateMany({
    where: { studentId, readAt: null, ...(ids && ids.length ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  }).catch(() => {});
}
