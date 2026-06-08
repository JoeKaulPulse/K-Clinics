import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('clients.view');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  // Replying as the clinic, taking a chat off the AI, or closing it are write
  // actions — read-only staff (clients.view) shouldn't be able to message
  // visitors. Gate the mutating ops behind consultations.manage.
  if (['reply', 'setMode', 'close'].includes(b.op)) {
    const writer = await requirePermission('consultations.manage');
    if (!writer) return NextResponse.json({ ok: false, error: 'You don’t have permission to respond to chats.' }, { status: 403 });
  }
  const { db } = await import('@/lib/db');

  try {
  switch (b.op) {
    case 'list': {
      const rows = await db.chatConversation.findMany({
        orderBy: [{ status: 'asc' }, { lastMessageAt: 'desc' }],
        take: 200,
        include: { messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, sender: true } } },
      });
      return NextResponse.json({ ok: true, conversations: rows.map((c) => ({
        id: c.id, visitorName: c.visitorName, visitorEmail: c.visitorEmail, status: c.status, mode: c.mode, staffUnread: c.staffUnread,
        lastMessageAt: c.lastMessageAt.toISOString(), preview: c.messages[0]?.body.slice(0, 80) ?? '',
      })) });
    }
    case 'messages': {
      if (!b.conversationId) return NextResponse.json({ ok: false }, { status: 400 });
      const id = String(b.conversationId);
      const [convo, messages] = await Promise.all([
        db.chatConversation.findUnique({ where: { id }, select: { id: true, visitorName: true, visitorEmail: true, status: true, mode: true, page: true } }),
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
      // A human replying takes the conversation off the AI (mode → STAFF) so the
      // assistant stops auto-answering until staff hand it back.
      // Who the visitor sees: a first name for regular staff (linked to their
      // public team profile when they've opted in); OWNER/ADMIN are presented as
      // "KClinics" with no name, per brand preference.
      const isAnon = ['OWNER', 'ADMIN'].includes(session.role);
      const firstName = isAnon ? null : ((session.name || '').trim().split(/\s+/)[0] || null);
      let authorPublic = false;
      let authorTitle: string | null = null;
      if (firstName) {
        const u = await db.adminUser.findUnique({ where: { id: session.sub }, select: { publicProfile: true, title: true } }).catch(() => null);
        authorPublic = !!u?.publicProfile;
        authorTitle = u?.title || null;
      }
      const staffMsg = await db.chatMessage.create({ data: { conversationId: id, sender: 'STAFF', author: session.email, authorName: firstName, authorTitle, authorId: isAnon ? null : session.sub, authorPublic, body } });
      await db.chatConversation.update({ where: { id }, data: { lastMessageAt: new Date(), status: 'OPEN', mode: 'STAFF', staffUnread: 0 } });
      // Email the visitor: forced when staff hit "Send & email"; otherwise only
      // if they've left their email and stepped away from the chat.
      let emailed = false;
      try { const { emailChatMessage } = await import('@/lib/chat-email'); emailed = await emailChatMessage(staffMsg.id, { force: b.email === true }); } catch { /* non-fatal */ }
      return NextResponse.json({ ok: true, emailed });
    }
    case 'setMode': {
      const id = String(b.conversationId || '');
      const mode = b.mode === 'AI' ? 'AI' : 'STAFF';
      if (!id) return NextResponse.json({ ok: false }, { status: 400 });
      await db.chatConversation.update({ where: { id }, data: { mode, ...(mode === 'AI' ? { staffUnread: 0 } : {}) } });
      return NextResponse.json({ ok: true, mode });
    }
    case 'close': {
      if (!b.conversationId) return NextResponse.json({ ok: false }, { status: 400 });
      await db.chatConversation.update({ where: { id: String(b.conversationId) }, data: { status: 'CLOSED' } });
      return NextResponse.json({ ok: true });
    }
  }
  return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
  } catch (e) {
    console.error('[admin/chat] op failed:', e);
    return NextResponse.json({ ok: false, error: 'Something went wrong — please retry.' }, { status: 500 });
  }
}
