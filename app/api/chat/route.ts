import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

const clean = (s: unknown, n = 2000) => (typeof s === 'string' ? s.trim().slice(0, n) : '');

// Visitor-facing chat. Identified by an unguessable conversation token kept in
// the visitor's browser — no auth required.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'Chat is unavailable right now.' }, { status: 503 });
  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'chat', 30, 60))) {
    return NextResponse.json({ ok: false, error: 'Please slow down a moment.' }, { status: 429 });
  }

  const b = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');

  if (b.op === 'start') {
    const body = clean(b.message);
    if (!body) return NextResponse.json({ ok: false, error: 'Type a message to start.' }, { status: 400 });
    const { getCurrentClient } = await import('@/lib/client-auth');
    const client = await getCurrentClient().catch(() => null);
    const convo = await db.chatConversation.create({
      data: {
        visitorName: clean(b.name, 80) || client?.firstName || null,
        visitorEmail: (clean(b.email, 160) || client?.email || '').toLowerCase() || null,
        clientId: client?.id ?? null,
        page: clean(b.page, 200) || null,
        // mode defaults to AI — the assistant answers first and notifies/hands
        // over to staff only when it needs a human, so staffUnread starts at 0.
        staffUnread: 0,
        lastVisitorSeenAt: new Date(),
        messages: { create: { sender: 'VISITOR', body } },
      },
      select: { id: true, token: true },
    });
    // Let the AI assistant answer (it notifies/hands over to staff as needed).
    const { maybeAutoReply } = await import('@/lib/chat-ai');
    await maybeAutoReply(convo.id);
    return NextResponse.json({ ok: true, token: convo.token });
  }

  if (b.op === 'send') {
    const token = clean(b.token, 60);
    const body = clean(b.message);
    if (!token || !body) return NextResponse.json({ ok: false, error: 'Bad request.' }, { status: 400 });
    const convo = await db.chatConversation.findUnique({ where: { token }, select: { id: true, mode: true } });
    if (!convo) return NextResponse.json({ ok: false, error: 'Conversation not found.' }, { status: 404 });
    await db.$transaction([
      db.chatMessage.create({ data: { conversationId: convo.id, sender: 'VISITOR', body } }),
      // Only flag staff as unread when a human is the one answering; in AI mode
      // the assistant replies and escalates (bumping unread) only if needed.
      db.chatConversation.update({ where: { id: convo.id }, data: { status: 'OPEN', lastMessageAt: new Date(), lastVisitorSeenAt: new Date(), ...(convo.mode === 'STAFF' ? { staffUnread: { increment: 1 } } : {}) } }),
    ]);
    if (convo.mode === 'AI') {
      const { maybeAutoReply } = await import('@/lib/chat-ai');
      await maybeAutoReply(convo.id);
    }
    return NextResponse.json({ ok: true });
  }

  // Visitor asks us to email them the chat ("email me this chat"). They can
  // supply an email if they didn't leave one earlier.
  if (b.op === 'emailTranscript') {
    const token = clean(b.token, 60);
    if (!token) return NextResponse.json({ ok: false, error: 'Bad request.' }, { status: 400 });
    const convo = await db.chatConversation.findUnique({ where: { token }, select: { id: true, visitorEmail: true } });
    if (!convo) return NextResponse.json({ ok: false, error: 'Conversation not found.' }, { status: 404 });
    const email = clean(b.email, 160).toLowerCase();
    if (!convo.visitorEmail && !email) return NextResponse.json({ ok: false, error: 'Enter your email so we can send it.' }, { status: 400 });
    const { emailChatTranscript } = await import('@/lib/chat-email');
    const r = await emailChatTranscript(convo.id, { actor: 'visitor', toOverride: convo.visitorEmail ? undefined : email });
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }

  return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
}

// Poll: return messages for the visitor's conversation since `after`.
export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, messages: [] }, { status: 503 });
  const url = new URL(req.url);
  const token = (url.searchParams.get('token') || '').trim();
  const after = url.searchParams.get('after');
  if (!token) return NextResponse.json({ ok: false, messages: [] }, { status: 400 });

  const { db } = await import('@/lib/db');
  const convo = await db.chatConversation.findUnique({ where: { token }, select: { id: true, status: true } });
  if (!convo) return NextResponse.json({ ok: false, messages: [] }, { status: 404 });
  // Presence: each poll refreshes "last seen" so we only email replies once the
  // visitor has actually left (see lib/chat-email visitorLeft).
  db.chatConversation.update({ where: { id: convo.id }, data: { lastVisitorSeenAt: new Date() } }).catch(() => {});
  const messages = await db.chatMessage.findMany({
    where: { conversationId: convo.id, ...(after ? { createdAt: { gt: new Date(after) } } : {}) },
    orderBy: { createdAt: 'asc' }, take: 100,
    select: { id: true, sender: true, body: true, createdAt: true, authorName: true, authorTitle: true, authorId: true, authorPublic: true },
  });
  return NextResponse.json({
    ok: true,
    status: convo.status,
    messages: messages.map((m) => ({
      id: m.id,
      sender: m.sender,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      // Who the visitor is speaking with — sourced from the responder's own
      // account. Staff show their first name (+ title); OWNER/ADMIN show as
      // "KClinics". The assistant shows as "K". When they've a public profile,
      // the name deep-links to their card on the team page.
      from: m.sender === 'AI' ? 'K · Assistant' : m.sender === 'STAFF' ? (m.authorName ? (m.authorTitle ? `${m.authorName} · ${m.authorTitle}` : m.authorName) : 'KClinics') : undefined,
      link: m.sender === 'STAFF' && m.authorPublic && m.authorId ? `/team#m-${m.authorId}` : undefined,
    })),
  });
}
