import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// The signed-in user's in-app notifications (header bell). GET lists recent;
// POST marks read. Never 500s the poll — degrades to empty.
export async function GET() {
  if (!crmEnabled) return NextResponse.json({ ok: false, items: [] });
  try {
    const { getSession } = await import('@/lib/auth');
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, items: [] });
    const { listNotifications, unreadCount } = await import('@/lib/notifications');
    const [items, unread] = await Promise.all([listNotifications(session.sub), unreadCount(session.sub)]);
    return NextResponse.json({ ok: true, unread, items: items.map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, href: n.href, readAt: n.readAt, createdAt: n.createdAt })) });
  } catch (e) {
    console.error('[notifications] list failed', e);
    return NextResponse.json({ ok: false, items: [] });
  }
}

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const { markRead } = await import('@/lib/notifications');
  // op 'read' with ids[] marks those; otherwise marks all read.
  await markRead(session.sub, Array.isArray(b.ids) && b.ids.length ? b.ids.map(String) : undefined);
  return NextResponse.json({ ok: true });
}
