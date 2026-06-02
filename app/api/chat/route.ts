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
        staffUnread: 1,
        messages: { create: { sender: 'VISITOR', body } },
      },
      select: { id: true, token: true },
    });
    // Notify the clinic so someone jumps in.
    try {
      const { sendEmail } = await import('@/lib/email');
      const { site } = await import('@/lib/site');
      await sendEmail({ to: process.env.CLINIC_NOTIFY_EMAIL || site.email, subject: 'New live chat started', html: `<p>A visitor started a live chat:</p><blockquote>${body.replace(/[<>]/g, '')}</blockquote><p>Reply in the CRM → Live chat.</p>` });
    } catch { /* non-fatal */ }
    return NextResponse.json({ ok: true, token: convo.token });
  }

  if (b.op === 'send') {
    const token = clean(b.token, 60);
    const body = clean(b.message);
    if (!token || !body) return NextResponse.json({ ok: false, error: 'Bad request.' }, { status: 400 });
    const convo = await db.chatConversation.findUnique({ where: { token }, select: { id: true } });
    if (!convo) return NextResponse.json({ ok: false, error: 'Conversation not found.' }, { status: 404 });
    await db.$transaction([
      db.chatMessage.create({ data: { conversationId: convo.id, sender: 'VISITOR', body } }),
      db.chatConversation.update({ where: { id: convo.id }, data: { status: 'OPEN', lastMessageAt: new Date(), staffUnread: { increment: 1 } } }),
    ]);
    return NextResponse.json({ ok: true });
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
  const messages = await db.chatMessage.findMany({
    where: { conversationId: convo.id, ...(after ? { createdAt: { gt: new Date(after) } } : {}) },
    orderBy: { createdAt: 'asc' }, take: 100,
    select: { id: true, sender: true, body: true, createdAt: true },
  });
  return NextResponse.json({ ok: true, status: convo.status, messages: messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })) });
}
