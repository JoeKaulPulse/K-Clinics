import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';
import { encClinical, decClinical } from '@/lib/clinical-crypto';

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
        // BLD-1160: visitor free-text can describe symptoms/treatment concerns —
        // encrypt at rest like Consultation.message/medicalNotes (lib/clinical-crypto).
        messages: { create: { sender: 'VISITOR', body: encClinical(body) as string } },
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
    const convo = await db.chatConversation.findUnique({ where: { token }, select: { id: true, mode: true, visitorName: true } });
    if (!convo) return NextResponse.json({ ok: false, error: 'Conversation not found.' }, { status: 404 });
    await db.$transaction([
      // BLD-1160: encrypt at rest, matching the 'start' path above.
      db.chatMessage.create({ data: { conversationId: convo.id, sender: 'VISITOR', body: encClinical(body) as string } }),
      // Only flag staff as unread when a human is the one answering; in AI mode
      // the assistant replies and escalates (bumping unread) only if needed.
      db.chatConversation.update({ where: { id: convo.id }, data: { status: 'OPEN', lastMessageAt: new Date(), lastVisitorSeenAt: new Date(), ...(convo.mode === 'STAFF' ? { staffUnread: { increment: 1 } } : {}) } }),
    ]);
    // When a human is handling the chat, ping the team that the visitor replied
    // (collapses per conversation so a flurry of messages is one updating row).
    if (convo.mode === 'STAFF') {
      const { notifyStaffByPermission } = await import('@/lib/notifications');
      await notifyStaffByPermission('clients.view', {
        kind: 'comment', category: 'messages', priority: 'high',
        title: `New message from ${convo.visitorName?.trim() || 'a visitor'}`, body: body.slice(0, 140),
        href: `/admin/chat?c=${convo.id}`, groupKey: `chat:${convo.id}`,
      }).catch(() => {});
    }
    if (convo.mode === 'AI') {
      const { maybeAutoReply } = await import('@/lib/chat-ai');
      await maybeAutoReply(convo.id);
    }
    return NextResponse.json({ ok: true });
  }

  // Visitor asks us to email them the chat ("email me this chat"). The
  // recipient is always the conversation's OWN established address — once a
  // conversation has a visitorEmail (left at chat start, or set by an earlier
  // call here), no later call can redirect the send elsewhere. Only a brand
  // new conversation with no email yet may supply one, and it sticks for good
  // (PRJ-1069.9: this previously accepted a client-supplied `email` on every
  // call with no such lock, and no dedicated rate limit — an attacker could
  // open a conversation, author whatever they liked as their own visitor
  // messages, then point delivery at any victim address, turning this into an
  // open relay riding the clinic's own sending domain/reputation). The email
  // body is always rendered server-side from this conversation's own stored
  // messages, never from client-supplied text.
  if (b.op === 'emailTranscript') {
    if (!(await enforceRateLimit(req, 'chat-transcript-email', 5, 3600))) {
      return NextResponse.json({ ok: false, error: 'Please try again later.' }, { status: 429 });
    }
    const token = clean(b.token, 60);
    if (!token) return NextResponse.json({ ok: false, error: 'Bad request.' }, { status: 400 });
    const convo = await db.chatConversation.findUnique({ where: { token }, select: { id: true, visitorEmail: true } });
    if (!convo) return NextResponse.json({ ok: false, error: 'Conversation not found.' }, { status: 404 });
    let email = '';
    if (!convo.visitorEmail) {
      email = clean(b.email, 160).toLowerCase();
      if (!email) return NextResponse.json({ ok: false, error: 'Enter your email so we can send it.' }, { status: 400 });
      // Anchored: an unanchored test only needs SOME substring to look like an
      // address, so "Real Name <a@b.co> anything" or a value with an embedded
      // newline would pass and be stored as visitorEmail / handed to the mailer.
      if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ ok: false, error: 'Enter a valid email address.' }, { status: 400 });
    }
    const { emailChatTranscript } = await import('@/lib/chat-email');
    const r = await emailChatTranscript(convo.id, { actor: 'visitor', toOverride: convo.visitorEmail ? undefined : email });
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }

  return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
}

// Poll: return messages for the visitor's conversation since `after`.
export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, messages: [] }, { status: 503 });
  const { enforceRateLimit } = await import('@/lib/security/guard');
  // Higher allowance than POST's 30/60 — this is a steady 4s poll while the
  // widget is open (~15/min per visitor), so it needs headroom above that
  // while still bounding a scripted token-enumeration sweep.
  if (!(await enforceRateLimit(req, 'chat-poll', 60, 60))) {
    return NextResponse.json({ ok: false, messages: [] }, { status: 429 });
  }
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
      // BLD-1160: bodies are encrypted at rest; decClinical tolerates legacy
      // plaintext rows written before this change.
      body: decClinical(m.body),
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
