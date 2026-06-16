import 'server-only';
import { db, withDbRetry } from '@/lib/db';

// In-app notifications for staff/admin. Deliberately best-effort: a notification
// must never break the action that triggered it, so every write is guarded.
//
// Each notification carries a CATEGORY (for grouping + per-user preferences) and a
// PRIORITY (low | normal | high | urgent). Callers may pass them explicitly; when
// they don't, they're derived from the kind + href so every existing call site is
// auto-categorised with no change. A per-user preference (AdminUser.notifPrefs) can
// turn a category's in-app notifications off (urgent always comes through). Bursts
// on the same groupKey collapse into one row instead of stacking. See docs/NOTIFICATIONS.md.

export type NotifyKind = 'assigned' | 'comment' | 'status' | 'idea_feedback' | 'mention' | 'system';
export type Category =
  | 'messages' | 'bookings' | 'clinical' | 'finance' | 'reviews'
  | 'inventory' | 'team' | 'academy' | 'marketing' | 'system';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';

export const CATEGORIES: Category[] = [
  'messages', 'bookings', 'clinical', 'finance', 'reviews', 'inventory', 'team', 'academy', 'marketing', 'system',
];
export const CATEGORY_LABEL: Record<Category, string> = {
  messages: 'Messages', bookings: 'Bookings', clinical: 'Clinical', finance: 'Finance', reviews: 'Reviews',
  inventory: 'Inventory', team: 'Team & schedule', academy: 'Academy', marketing: 'Marketing', system: 'System',
};
// Per-category channel defaults. In-app on everywhere (so behaviour is unchanged
// for existing users); email is opt-in per user (Phase 1 does not auto-send staff
// email — the toggle is captured for the email phase).
export const CATEGORY_DEFAULTS: Record<Category, { inApp: boolean; email: boolean }> = {
  messages: { inApp: true, email: false }, bookings: { inApp: true, email: false },
  clinical: { inApp: true, email: false }, finance: { inApp: true, email: false },
  reviews: { inApp: true, email: false }, inventory: { inApp: true, email: false },
  team: { inApp: true, email: false }, academy: { inApp: true, email: false },
  marketing: { inApp: true, email: false }, system: { inApp: true, email: false },
};

export type NotifPrefs = {
  inApp?: Partial<Record<Category, boolean>>;
  email?: Partial<Record<Category, boolean>>;
  quietHours?: { start: string; end: string } | null; // "20:00" .. "08:00" (Phase 2 push/email)
  digest?: 'off' | 'daily' | 'weekly';
  chatSound?: boolean;
};

function mergePrefs(raw: unknown): NotifPrefs {
  return raw && typeof raw === 'object' ? (raw as NotifPrefs) : {};
}
function inAppEnabled(prefs: NotifPrefs, c: Category): boolean {
  return prefs.inApp?.[c] ?? CATEGORY_DEFAULTS[c]?.inApp ?? true;
}
export function emailEnabled(prefs: NotifPrefs, c: Category): boolean {
  return prefs.email?.[c] ?? CATEGORY_DEFAULTS[c]?.email ?? false;
}

/** Categorise a notification from its destination (and kind) when not given. */
export function deriveCategory(kind: string, href?: string): Category {
  const h = href || '';
  if (h.includes('/admin/chat')) return 'messages';
  if (h.includes('/admin/bookings')) return 'bookings';
  if (h.includes('/admin/consultations') || h.includes('/admin/clients')) return 'clinical';
  if (h.includes('/admin/reviews')) return 'reviews';
  if (h.includes('/admin/inventory') || h.includes('/admin/orders')) return 'inventory';
  if (h.includes('/admin/time-off') || h.includes('/admin/schedule') || h.includes('/admin/my-day')) return 'team';
  if (h.includes('/admin/tasks')) return 'team';
  if (h.includes('/admin/academy')) return 'academy';
  if (h.includes('/admin/marketing')) return 'marketing';
  if (h.includes('/admin/build') || h.includes('/admin/status')) return 'system';
  if (kind === 'mention') return 'clinical';
  return 'system';
}
function derivePriority(kind: string): Priority {
  return kind === 'mention' ? 'high' : 'normal';
}

export type NotifInput = {
  kind: NotifyKind; title: string; body?: string; href?: string;
  category?: Category; priority?: Priority; groupKey?: string;
};

/** The single creator: categorises, prioritises, honours the user's per-category
 *  in-app preference (urgent overrides), collapses bursts on a groupKey, and
 *  de-dupes an identical unread within 10 minutes. Best-effort. */
async function createFor(user: { id: string; notifPrefs?: unknown }, n: NotifInput): Promise<void> {
  const category = n.category ?? deriveCategory(n.kind, n.href);
  const priority = n.priority ?? derivePriority(n.kind);
  const prefs = mergePrefs(user.notifPrefs);
  if (priority !== 'urgent' && !inAppEnabled(prefs, category)) return; // muted by the user
  const data = {
    category, priority, kind: n.kind,
    title: n.title.slice(0, 200), body: n.body?.slice(0, 1000) || null, href: n.href?.slice(0, 300) || null,
  };
  // Collapse a burst (same groupKey, still unread) into one updating row.
  if (n.groupKey) {
    const existing = await db.staffNotification.findFirst({ where: { userId: user.id, groupKey: n.groupKey, readAt: null }, select: { id: true } });
    if (existing) { await db.staffNotification.update({ where: { id: existing.id }, data: { ...data, createdAt: new Date() } }); return; }
    await db.staffNotification.create({ data: { userId: user.id, groupKey: n.groupKey, ...data } });
    return;
  }
  // De-dupe: skip an identical unread notification raised in the last 10 minutes.
  const dupe = await db.staffNotification.findFirst({
    where: { userId: user.id, kind: n.kind, title: data.title, href: data.href, readAt: null, createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
    select: { id: true },
  });
  if (dupe) return;
  await db.staffNotification.create({ data: { userId: user.id, ...data } });
}

/** Notify a staff member by email. No-ops cleanly if the email isn't a known
 *  active user, or if the recipient is the actor (don't notify yourself). */
export async function notifyStaff(email: string | null | undefined, n: NotifInput, actorEmail?: string): Promise<void> {
  try {
    const to = (email || '').trim().toLowerCase();
    if (!to || to === 'claude' || to === 'system') return;
    if (actorEmail && to === actorEmail.trim().toLowerCase()) return;
    const user = await db.adminUser.findUnique({ where: { email: to }, select: { id: true, active: true, notifPrefs: true } });
    if (!user || !user.active) return;
    await createFor(user, n);
  } catch (e) {
    console.error('[notifications] create failed (non-fatal)', (e as Error)?.message);
  }
}

/** Notify a staff member by AdminUser id (used where we hold ids, not emails —
 *  e.g. task assignment). No-ops if the recipient is the actor or inactive. */
export async function notifyStaffById(userId: string | null | undefined, n: NotifInput, actorUserId?: string): Promise<void> {
  try {
    if (!userId || (actorUserId && userId === actorUserId)) return;
    const user = await db.adminUser.findUnique({ where: { id: userId }, select: { id: true, active: true, notifPrefs: true } });
    if (!user || !user.active) return;
    await createFor(user, n);
  } catch (e) {
    console.error('[notifications] notifyStaffById failed (non-fatal)', (e as Error)?.message);
  }
}

/** Notify every active staff member whose role (plus per-user overrides) grants
 *  `permission`. Skips the actor. Honours each recipient's preferences. Best-effort;
 *  returns the count actually targeted. */
export async function notifyStaffByPermission(permission: string, n: NotifInput, actorEmail?: string): Promise<number> {
  try {
    const { effectivePermissions } = await import('@/lib/permissions');
    const actor = (actorEmail || '').trim().toLowerCase();
    const users = await db.adminUser.findMany({ where: { active: true }, select: { id: true, email: true, role: true, permGrant: true, permRevoke: true, notifPrefs: true } });
    const recipients = users.filter((u) => {
      if (u.email.trim().toLowerCase() === actor) return false;
      if (u.role === 'OWNER') return true;
      return effectivePermissions({ role: u.role, permGrant: u.permGrant, permRevoke: u.permRevoke }).has(permission);
    });
    await Promise.all(recipients.map((u) => createFor(u, n).catch(() => {})));
    return recipients.length;
  } catch (e) {
    console.error('[notifications] notifyStaffByPermission failed (non-fatal)', (e as Error)?.message);
    return 0;
  }
}

export async function unreadCount(userId: string): Promise<number> {
  try { return await withDbRetry(() => db.staffNotification.count({ where: { userId, readAt: null } }), 2); }
  catch { return 0; }
}

/** Unread counts grouped by category, for the bell's per-category chips. */
export async function unreadByCategory(userId: string): Promise<Record<string, number>> {
  try {
    const rows = await db.staffNotification.groupBy({ by: ['category'], where: { userId, readAt: null }, _count: { _all: true } });
    const out: Record<string, number> = {};
    for (const r of rows) out[r.category || 'system'] = r._count._all;
    return out;
  } catch { return {}; }
}

export async function listNotifications(userId: string, opts: { take?: number; category?: Category | null } = {}) {
  const { take = 20, category = null } = opts;
  return withDbRetry(
    () => db.staffNotification.findMany({ where: { userId, ...(category ? { category } : {}) }, orderBy: { createdAt: 'desc' }, take }),
    2,
  ).catch(() => []);
}

export async function markRead(userId: string, ids?: string[]): Promise<void> {
  await db.staffNotification.updateMany({
    where: { userId, readAt: null, ...(ids && ids.length ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  }).catch(() => {});
}

export async function getNotifPrefs(userId: string): Promise<NotifPrefs> {
  const u = await db.adminUser.findUnique({ where: { id: userId }, select: { notifPrefs: true } }).catch(() => null);
  return mergePrefs(u?.notifPrefs);
}

export async function setNotifPrefs(userId: string, prefs: NotifPrefs): Promise<void> {
  await db.adminUser.update({ where: { id: userId }, data: { notifPrefs: prefs as object } }).catch(() => {});
}
