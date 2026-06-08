import 'server-only';
import { db } from '@/lib/db';
import { site } from '@/lib/site';
import { sendEmail, emailShell } from '@/lib/email';

// ─────────────────────────────────────────────────────────────────────────────
// Live-chat ↔ email bridge.
//
// When a visitor leaves their email and then steps away, any staff/AI reply is
// emailed to them (Resend) so the conversation isn't lost. The email's Reply-To
// is a per-conversation tagged address (chat-<token>@<inbound domain>) — when
// they reply, Resend Inbound delivers it to /api/webhooks/chat-inbound, which
// threads it back into the SAME conversation as a visitor message.
//
// Decisions (documented inline):
//  • Use the conversation's existing unguessable `token` as the reply key — no
//    new secret, and it can't be guessed to hijack another conversation.
//  • "Left" = no widget activity for LEFT_MS (presence is refreshed on every
//    poll/send). This avoids emailing someone who's actively reading the chat.
//  • Each message is emailed at most once (`emailedAt`), so the reply-time send
//    and the cron sweep can't double-send.
// ─────────────────────────────────────────────────────────────────────────────

const hostname = (() => { try { return new URL(site.url).hostname.replace(/^www\./, ''); } catch { return 'kclinics.co.uk'; } })();
// Inbound domain for chat replies (Resend Inbound). A subdomain keeps inbound
// MX separate from the clinic's normal mailboxes.
const INBOUND_DOMAIN = process.env.CHAT_INBOUND_DOMAIN || `reply.${hostname}`;
const LEFT_MS = 90_000; // visitor considered "gone" after 90s of no activity

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] || c));

/** The per-conversation reply address (Resend Inbound routes this to the webhook). */
export function chatReplyAddress(token: string): string {
  return `chat-${token}@${INBOUND_DOMAIN}`;
}

/** Stable thread id so the visitor's mail client groups our replies together. */
function threadId(conversationId: string): string {
  return `<chat-${conversationId}@${hostname}>`;
}

/** Has the visitor left? (no poll/activity within LEFT_MS, or never seen). */
export function visitorLeft(lastSeen: Date | null | undefined): boolean {
  return !lastSeen || Date.now() - new Date(lastSeen).getTime() > LEFT_MS;
}

/**
 * Email a single staff/AI chat message to the visitor and mark it emailed.
 * No-ops when there's no email, the chat is closed, it was already emailed, or
 * (unless `force`) the visitor is still actively in the chat.
 */
export async function emailChatMessage(messageId: string, opts: { force?: boolean } = {}): Promise<boolean> {
  const msg = await db.chatMessage.findUnique({ where: { id: messageId }, include: { conversation: true } });
  if (!msg || msg.sender === 'VISITOR' || msg.emailedAt) return false;
  const c = msg.conversation;
  if (!c.visitorEmail || c.status === 'CLOSED') return false;
  if (!opts.force && !visitorLeft(c.lastVisitorSeenAt)) return false;

  const who = msg.sender === 'AI'
    ? 'K, our virtual assistant'
    : msg.authorName
      ? `${esc(msg.authorName)}${msg.authorTitle ? `, ${esc(msg.authorTitle)},` : ''} at KClinics`
      : 'the KClinics team';
  const tid = threadId(c.id);
  const html = emailShell({
    preheader: msg.body.slice(0, 120),
    body: `<h1 style="font-size:24px;margin:0 0 16px;">A reply from KClinics</h1>
      <p>Hi${c.visitorName ? ` ${esc(c.visitorName)}` : ''} — you were chatting with us and stepped away, so here's the reply from ${who}:</p>
      <div style="margin:18px 0;padding:16px 18px;background:#efe3d7;border-radius:12px;white-space:pre-wrap;color:#2a2420;">${esc(msg.body)}</div>
      <p style="color:#7d6259;font-size:14px;"><strong>Just reply to this email</strong> — your message goes straight back to the same conversation and we'll pick it up from there.</p>
      <p style="margin-top:22px;">With warmth,<br>The KClinics team</p>`,
  });

  const res = await sendEmail({
    to: c.visitorEmail,
    subject: 'Re: your conversation with KClinics',
    html,
    replyTo: chatReplyAddress(c.token),
    headers: { 'In-Reply-To': tid, References: tid },
  });
  if (!res.ok) return false;
  await db.chatMessage.update({ where: { id: msg.id }, data: { emailedAt: new Date() } });
  await db.chatConversation.update({ where: { id: c.id }, data: { updatedAt: new Date() } }).catch(() => {});
  return true;
}

/**
 * Sweep: email any unseen staff/AI reply once the visitor has clearly left.
 * Catches the case where the reply landed while they were still present but they
 * left moments later without reading it. Run from the frequent dispatch cron.
 */
export async function sweepChatEmailFollowups(): Promise<{ emailed: number }> {
  const cutoff = new Date(Date.now() - LEFT_MS);
  const convos = await db.chatConversation.findMany({
    where: { status: 'OPEN', visitorEmail: { not: null }, lastMessageAt: { lt: cutoff } },
    select: {
      id: true,
      lastVisitorSeenAt: true,
      messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, sender: true, emailedAt: true, createdAt: true } },
    },
    take: 200,
  });
  let emailed = 0;
  for (const c of convos) {
    const last = c.messages[0];
    if (!last || last.sender === 'VISITOR' || last.emailedAt) continue;
    // Skip if the visitor was seen after the reply was posted (they read it in-chat).
    if (c.lastVisitorSeenAt && new Date(c.lastVisitorSeenAt) > new Date(last.createdAt)) continue;
    if (await emailChatMessage(last.id)) emailed += 1;
  }
  return { emailed };
}

/** Strip the quoted/original portion from an inbound email reply, best-effort. */
export function stripQuotedReply(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  for (const line of lines) {
    if (/^\s*>/.test(line)) break; // quoted block
    if (/^\s*On .+ wrote:\s*$/.test(line)) break; // "On <date>, <name> wrote:"
    if (/^-{2,}\s*Original Message\s*-{2,}/i.test(line)) break;
    if (/^\s*From:\s.+/.test(line) && out.length) break;
    out.push(line);
  }
  return out.join('\n').trim() || text.trim();
}

/** Pull the conversation token out of any chat-<token>@… recipient address. */
export function tokenFromAddresses(addresses: string[]): string | null {
  for (const a of addresses) {
    const m = a.match(/chat-([a-z0-9]+)@/i);
    if (m) return m[1];
  }
  return null;
}
