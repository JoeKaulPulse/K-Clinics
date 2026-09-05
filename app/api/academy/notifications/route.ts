import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// BLD-1620: the signed-in trainee's in-app notifications (portal bell). GET
// lists recent with the unread count; POST marks read (specific ids, or all).
// Never 500s the poll — mirrors app/api/admin/notifications/route.ts.
export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, items: [], unread: 0 });
  try {
    const { getCurrentStudent } = await import('@/lib/academy-auth');
    const student = await getCurrentStudent().catch(() => null);
    if (!student) return NextResponse.json({ ok: false, items: [], unread: 0 });
    const url = new URL(req.url);
    const take = Math.min(50, Math.max(1, Number(url.searchParams.get('take')) || 20));
    const { listNotifications, unreadCount } = await import('@/lib/academy-notifications');
    const [items, unread] = await Promise.all([listNotifications(student.id, take), unreadCount(student.id)]);
    return NextResponse.json({
      ok: true, unread,
      items: items.map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, href: n.href, readAt: n.readAt, createdAt: n.createdAt })),
    });
  } catch (e) {
    console.error('[academy-notifications] list failed', e);
    return NextResponse.json({ ok: false, items: [], unread: 0 });
  }
}

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) return NextResponse.json({ ok: false }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const { markRead } = await import('@/lib/academy-notifications');
  await markRead(student.id, Array.isArray(b.ids) && b.ids.length ? b.ids.map(String) : undefined);
  return NextResponse.json({ ok: true });
}
