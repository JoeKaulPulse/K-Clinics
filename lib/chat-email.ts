import 'server-only';
import { db } from '@/lib/db';
import { site } from '@/lib/site';
import { sendEmail, tmplChatReply, tmplChatTranscript } from '@/lib/email';

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
// Inbound domain for chat replies (Resend Inbound). Defaults to the clinic's
// dedicated inbound subdomain (mail.kclinics.co.uk) so inbound stays separate
// from normal mailboxes; override with CHAT_INBOUND_DOMAIN (e.g. the Resend
// sandbox domain like …​.resend.app while the custom domain verifies).
const INBOUND_DOMAIN = process.env.CHAT_INBOUND_DOMAIN || `mail.${hostname}`;
const LEFT_MS = 90_000; // visitor considered "gone" after 90s of no activity

// Chat email sends from the dedicated mail subdomain so in + out are unified on
// one domain (replies route to the chat-<token>@ address on the same domain).
export function chatFrom(): string { return `KClinics <chat@${INBOUND_DOMAIN}>`; }

/** Log a chat email so it shows on the conversation audit + gets Resend status. */
async function logChatEmail(o: { conversationId: string; clientId: string | null; to: string; subject: string; chatKind: 'reply' | 'transcript'; res: { ok: boolean; id?: string; error?: string } }) {
  await db.emailEvent.create({
    data: {
      clientId: o.clientId, kind: 'CHAT', to: o.to, subject: o.subject,
      status: o.res.ok ? 'SENT' : 'FAILED', providerId: o.res.id, error: o.res.error,
      meta: { conversationId: o.conversationId, chatKind: o.chatKind },
    },
  }).catch(() => {});
}

/** Chat emails recorded for a conversation, newest first (for the audit panel). */
export async function listChatEmails(conversationId: string) {
  return db.emailEvent.findMany({
    where: { kind: 'CHAT', meta: { path: ['conversationId'], equals: conversationId } },
    orderBy: { createdAt: 'desc' }, take: 50,
    select: { id: true, to: true, subject: true, status: true, openedAt: true, createdAt: true, meta: true },
  }).catch(() => []);
}

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
      ? `${msg.authorName}${msg.authorTitle ? `, ${msg.authorTitle},` : ''} at KClinics`
      : 'the KClinics team';
  const tid = threadId(c.id);
  const html = tmplChatReply({ visitorName: c.visitorName, who, body: msg.body });

  const subject = 'Re: your conversation with KClinics';
  const res = await sendEmail({
    to: c.visitorEmail,
    subject,
    html,
    from: chatFrom(),
    replyTo: chatReplyAddress(c.token),
    headers: { 'In-Reply-To': tid, References: tid },
  });
  if (!res.ok) return false;
  await db.chatMessage.update({ where: { id: msg.id }, data: { emailedAt: new Date() } });
  await db.chatConversation.update({ where: { id: c.id }, data: { updatedAt: new Date() } }).catch(() => {});
  await logChatEmail({ conversationId: c.id, clientId: c.clientId, to: c.visitorEmail, subject, chatKind: 'reply', res });
  return true;
}

/**
 * Email the full conversation transcript to the visitor — on chat end, or when
 * staff / the visitor request it. Records it on the audit and posts a system note.
 */
export async function emailChatTranscript(conversationId: string, opts: { actor: string; toOverride?: string } = { actor: 'system' }): Promise<{ ok: boolean; error?: string }> {
  const c = await db.chatConversation.findUnique({
    where: { id: conversationId },
    include: { messages: { orderBy: { createdAt: 'asc' }, take: 500 } },
  });
  if (!c) return { ok: false, error: 'Conversation not found.' };
  const to = (opts.toOverride || c.visitorEmail || '').trim();
  if (!to) return { ok: false, error: 'No email address on this conversation.' };

  const tid = threadId(c.id);
  const subject = 'Your conversation with KClinics';
  const res = await sendEmail({
    to,
    subject,
    html: tmplChatTranscript({ visitorName: c.visitorName, messages: c.messages.map((m) => ({ sender: m.sender, authorName: m.authorName, body: m.body, createdAt: m.createdAt })) }),
    from: chatFrom(),
    replyTo: chatReplyAddress(c.token),
    headers: { 'In-Reply-To': tid, References: tid },
  });
  if (!res.ok) return { ok: false, error: res.error || 'Could not send.' };
  // If the visitor gave a new email here, remember it for future replies.
  if (!c.visitorEmail && opts.toOverride) await db.chatConversation.update({ where: { id: c.id }, data: { visitorEmail: to.toLowerCase() } }).catch(() => {});
  await db.chatMessage.create({ data: { conversationId: c.id, sender: 'AI', author: 'system', body: `📧 Transcript emailed to ${to}.`, via: 'email' } }).catch(() => {});
  await db.chatConversation.update({ where: { id: c.id }, data: { lastMessageAt: new Date() } }).catch(() => {});
  await logChatEmail({ conversationId: c.id, clientId: c.clientId, to, subject, chatKind: 'transcript', res });
  return { ok: true };
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
