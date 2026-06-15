import crypto from 'node:crypto';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Resend Inbound webhook → threads a visitor's email reply back into the SAME
// live-chat conversation. Replies are sent to chat-<token>@<inbound domain>
// (see lib/chat-email.chatReplyAddress); Resend delivers them here. We match the
// conversation by that token (with header/sender fallbacks), strip the quoted
// original, and append it as a visitor message so staff see it in the CRM chat.
//
// Verified with the Svix signature when a secret is set (RESEND_INBOUND_SECRET,
// falling back to RESEND_WEBHOOK_SECRET).
function verify(secret: string, headers: Headers, body: string): boolean {
  try {
    const id = headers.get('svix-id'); const ts = headers.get('svix-timestamp'); const sig = headers.get('svix-signature');
    if (!id || !ts || !sig) return false;
    const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
    const expected = crypto.createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64');
    return sig.split(' ').some((s) => s.split(',')[1] === expected);
  } catch { return false; }
}

type Addr = string | { address?: string; email?: string; name?: string };
function collect(...vals: unknown[]): string[] {
  const out: string[] = [];
  const push = (v: unknown) => {
    if (!v) return;
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(push);
    else if (typeof v === 'object') { const a = v as Addr as { address?: string; email?: string }; if (a.address) out.push(a.address); if (a.email) out.push(a.email); }
  };
  vals.forEach(push);
  return out;
}

export async function POST(req: Request) {
  if (!crmEnabled) return new Response('ok');
  const body = await req.text();
  const secret = process.env.RESEND_INBOUND_SECRET || process.env.RESEND_WEBHOOK_SECRET;
  // BLD-279: fail closed on every environment with a real DB attached (incl.
  // previews), not just production — a forged inbound could write to the DB.
  if (!secret) {
    const { hasDatabase } = await import('@/lib/crm');
    if (hasDatabase) return new Response('webhook secret not configured', { status: 503 });
  } else if (!verify(secret, req.headers, body)) {
    return new Response('bad signature', { status: 401 });
  }

  let evt: { type?: string; data?: Record<string, unknown> };
  try { evt = JSON.parse(body); } catch { return new Response('bad json', { status: 400 }); }
  const data = (evt.data || {}) as Record<string, unknown>;
  const headers = (data.headers || {}) as Record<string, unknown>;

  const { db } = await import('@/lib/db');
  const { stripQuotedReply, tokenFromAddresses } = await import('@/lib/chat-email');

  // 1) Find the conversation. Prefer the chat-<token>@ recipient address.
  const recipients = collect(data.to, data.cc, headers.to, headers.To, headers.Cc);
  let convo = null as { id: string } | null;
  const token = tokenFromAddresses(recipients);
  if (token) convo = await db.chatConversation.findUnique({ where: { token }, select: { id: true } });

  // 2) Fallback: In-Reply-To / References carry <chat-<conversationId>@host>.
  if (!convo) {
    const refs = collect(headers['in-reply-to'], headers['In-Reply-To'], headers.references, headers.References).join(' ');
    const m = refs.match(/chat-([a-z0-9]+)@/i);
    if (m) convo = await db.chatConversation.findUnique({ where: { id: m[1] }, select: { id: true } }).catch(() => null);
  }

  // 3) Last resort: most recent open conversation for the sender's email.
  const fromList = collect(data.from, headers.from, headers.From);
  const fromEmail = (fromList[0]?.match(/<([^>]+)>/)?.[1] || fromList[0] || '').toLowerCase().trim() || null;
  if (!convo && fromEmail) {
    convo = await db.chatConversation.findFirst({ where: { visitorEmail: fromEmail, status: 'OPEN' }, orderBy: { lastMessageAt: 'desc' }, select: { id: true } });
  }
  if (!convo) return new Response('ok'); // nothing to attach to — drop quietly

  // De-duplicate redelivered webhooks by the email Message-ID.
  const externalId = String((data.message_id as string) || (data.id as string) || (headers['message-id'] as string) || (headers['Message-ID'] as string) || '').slice(0, 200) || null;
  if (externalId) {
    const seen = await db.chatMessage.findFirst({ where: { externalId }, select: { id: true } });
    if (seen) return new Response('ok');
  }

  const raw = String((data.text as string) || (data.html as string)?.replace(/<[^>]+>/g, ' ') || '').slice(0, 8000);
  const message = stripQuotedReply(raw).slice(0, 4000);
  if (!message) return new Response('ok');

  await db.chatMessage.create({ data: { conversationId: convo.id, sender: 'VISITOR', body: message, via: 'email', externalId } });
  await db.chatConversation.update({
    where: { id: convo.id },
    data: { status: 'OPEN', mode: 'STAFF', lastMessageAt: new Date(), lastVisitorSeenAt: new Date(), staffUnread: { increment: 1 } },
  });
  return new Response('ok');
}
