import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';
import type { Category } from '@/lib/notifications';

export const runtime = 'nodejs';

// The signed-in user's in-app notifications (header bell + /admin/notifications).
// GET lists recent (optionally filtered by category) with per-category unread
// counts; POST marks read (specific ids, or all). Never 500s the poll.
export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, items: [], unread: 0, byCategory: {} });
  try {
    const { getSession } = await import('@/lib/auth');
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, items: [], unread: 0, byCategory: {} });
    const url = new URL(req.url);
    const category = (url.searchParams.get('category') || '') as Category | '';
    const take = Math.min(100, Math.max(1, Number(url.searchParams.get('take')) || 20));
    const { listNotifications, unreadCount, unreadByCategory } = await import('@/lib/notifications');
    const [items, unread, byCategory] = await Promise.all([
      listNotifications(session.sub, { take, category: category || null }),
      unreadCount(session.sub),
      unreadByCategory(session.sub),
    ]);
    return NextResponse.json({
      ok: true, unread, byCategory,
      items: items.map((n) => ({ id: n.id, kind: n.kind, category: n.category, priority: n.priority, title: n.title, body: n.body, href: n.href, readAt: n.readAt, createdAt: n.createdAt })),
    });
  } catch (e) {
    console.error('[notifications] list failed', e);
    return NextResponse.json({ ok: false, items: [], unread: 0, byCategory: {} });
  }
}

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const { markRead } = await import('@/lib/notifications');
  // ids[] marks just those (per-row read); otherwise marks all read.
  await markRead(session.sub, Array.isArray(b.ids) && b.ids.length ? b.ids.map(String) : undefined);
  return NextResponse.json({ ok: true });
}
