import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('clients.view');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');

  switch (b.op) {
    case 'list': {
      const rows = await db.chatConversation.findMany({
        orderBy: [{ status: 'asc' }, { lastMessageAt: 'desc' }],
        take: 100,
        include: { messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, sender: true } } },
      });
      return NextResponse.json({ ok: true, conversations: rows.map((c) => ({
        id: c.id, visitorName: c.visitorName, visitorEmail: c.visitorEmail, status: c.status, staffUnread: c.staffUnread,
        lastMessageAt: c.lastMessageAt.toISOString(), preview: c.messages[0]?.body.slice(0, 80) ?? '',
      })) });
    }
    case 'messages': {
      if (!b.conversationId) return NextResponse.json({ ok: false }, { status: 400 });
      const id = String(b.conversationId);
      const [convo, messages] = await Promise.all([
        db.chatConversation.findUnique({ where: { id }, select: { id: true, visitorName: true, visitorEmail: true, status: true, page: true } }),
        db.chatMessage.findMany({ where: { conversationId: id }, orderBy: { createdAt: 'asc' }, take: 300, select: { id: true, sender: true, author: true, body: true, createdAt: true } }),
      ]);
      if (!convo) return NextResponse.json({ ok: false }, { status: 404 });
      await db.chatConversation.update({ where: { id }, data: { staffUnread: 0 } }).catch(() => {});
      return NextResponse.json({ ok: true, conversation: convo, messages: messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })) });
    }
    case 'reply': {
      const id = String(b.conversationId || '');
      const body = String(b.body || '').trim().slice(0, 2000);
      if (!id || !body) return NextResponse.json({ ok: false, error: 'Empty reply.' }, { status: 400 });
      await db.$transaction([
        db.chatMessage.create({ data: { conversationId: id, sender: 'STAFF', author: session.email, body } }),
        db.chatConversation.update({ where: { id }, data: { lastMessageAt: new Date(), status: 'OPEN' } }),
      ]);
      return NextResponse.json({ ok: true });
    }
    case 'close': {
      if (!b.conversationId) return NextResponse.json({ ok: false }, { status: 400 });
      await db.chatConversation.update({ where: { id: String(b.conversationId) }, data: { status: 'CLOSED' } });
      return NextResponse.json({ ok: true });
    }
  }
  return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
}
