import 'server-only';
import { db } from '@/lib/db';
import { site } from '@/lib/site';
import { getSecret } from '@/lib/secrets';

// ── Live-chat AI agent ───────────────────────────────────────────────────────
// A cheap Claude Haiku agent that answers most visitor chat messages, grounded
// in the real treatment catalogue, prices, opening hours, booking flow and
// FAQs. It NEVER gives medical advice and hands over to a human whenever the
// question is clinical, a complaint, a complex/bespoke quote, or anything it
// can't confidently answer. On hand-over the conversation flips to STAFF mode
// (the agent goes quiet) and the clinic is notified.

const HAIKU = 'claude-haiku-4-5-20251001';
const MAX_HISTORY = 14; // messages of context sent to the model

/** Is the clinic open right now (Europe/London vs site.hours)? */
export function isOpenNow(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value;
  let hh = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const mm = parts.find((p) => p.type === 'minute')?.value ?? '00';
  if (hh === '24') hh = '00';
  const today = site.hours.find((h) => h.day === weekday);
  if (!today || today.open === 'Closed') return false;
  const cur = Number(hh) * 60 + Number(mm);
  const [oh, om] = today.open.split(':').map(Number);
  const [ch, cm] = today.close.split(':').map(Number);
  return cur >= oh * 60 + om && cur < ch * 60 + cm;
}

const hoursText = () =>
  site.hours.map((h) => `${h.day}: ${h.open === 'Closed' ? 'Closed' : `${h.open}–${h.close}`}`).join('; ');

// Build a compact, grounded knowledge block from the live catalogue + FAQs.
async function buildKnowledge(): Promise<string> {
  const lines: string[] = [];
  try {
    const { listServices, liveOffers } = await import('@/lib/services');
    const services = await listServices(false);
    const byId = new Map(services.map((s) => [s.id, s.name]));
    const menu = services
      .map((s) => {
        const priced = s.variants.filter((v) => v.pricePence > 0).sort((a, b) => a.pricePence - b.pricePence);
        const from = priced[0]?.pricePence;
        return from ? `- ${s.name} (${s.category}) — from £${Math.round(from / 100)}` : `- ${s.name} (${s.category})`;
      });
    if (menu.length) lines.push('TREATMENTS & PRICES (from-prices; full pricing at /pricing):\n' + menu.join('\n'));

    const offers = await liveOffers(true).catch(() => []);
    const offerLines = offers.map((o) => {
      const amount = o.percentOff ? `${o.percentOff}% off` : o.amountOffPence ? `£${Math.round(o.amountOffPence / 100)} off` : 'a special offer';
      const what = o.scope === 'ALL' ? 'everything' : o.serviceId ? (byId.get(o.serviceId) ?? 'selected treatments') : 'selected treatments';
      return `- ${o.name}: ${amount} on ${what}`;
    });
    if (offerLines.length) lines.push('CURRENT OFFERS (see /offers):\n' + offerLines.join('\n'));
  } catch { /* catalogue optional */ }

  try {
    const { allGeneralFaqs } = await import('@/lib/faqs');
    const faq = allGeneralFaqs.slice(0, 12).map((f) => `Q: ${f.q}\nA: ${f.a}`).join('\n');
    if (faq) lines.push('FREQUENTLY ASKED QUESTIONS:\n' + faq);
  } catch { /* faqs optional */ }

  return lines.join('\n\n');
}

function systemPrompt(knowledge: string, open: boolean): string {
  return `You are "K", the friendly virtual assistant for KClinics — an aesthetics & aesthetic-dentistry clinic in Clerkenwell, Islington, London. You answer visitor messages in a live chat on the website.

ABOUT THE CLINIC
- Address: ${site.address.street}, ${site.address.locality}, ${site.address.region} ${site.address.postalCode} (near Farringdon & Barbican).
- Phone: ${site.phone}. Email: ${site.email}.
- Opening hours: ${hoursText()} (London time).
- Booking: visitors book online at ${site.booking.path} — they pick a treatment & time and save a card securely; nothing is charged until the treatment is delivered (or per the 24-hour cancellation policy). Consultations are complimentary.
- Dentistry status: ${site.dentistryLive ? 'open and bookable.' : 'opening soon — dentistry is not bookable yet; invite interested visitors to register interest on the dentistry page.'}
- The clinic is currently ${open ? 'OPEN — staff are available to take over.' : 'CLOSED — no staff are online right now.'}

${knowledge}

HOW TO BEHAVE
- Be warm, concise (1–3 short sentences), and helpful. British English. Never pushy.
- Answer general questions: what treatments are offered, indicative from-prices, opening hours, location/parking/transport, how booking & payment work, consultations, offers, and the FAQs above.
- Always point people to book at ${site.booking.path} or to a complimentary consultation when they're ready. Share the phone number for anything time-sensitive.
- Use ONLY the facts above. If you don't know a price or detail, say you're not certain and offer to connect them with the team — do NOT invent prices, results, claims or reviews.

NEVER
- Never give medical, clinical, dosage, diagnosis or treatment-suitability advice, and never promise specific results. For anything clinical ("is X safe for me", "what's wrong with my skin", side-effects, medications, pregnancy, conditions), say it needs a clinician and hand over.
- Never discuss or confirm anyone's personal/medical records.
- Never quote bespoke or large treatment-plan prices as final — those need a consultation.

WHEN TO HAND OVER TO A HUMAN (set "escalate": true)
- Clinical/medical questions or suitability/safety for the individual.
- Complaints, refunds, disputes, or anything about an existing appointment/their account.
- Bespoke quotes, complex multi-treatment plans, or anything you can't answer confidently from the facts above.
- The visitor explicitly asks to speak to a person.
When you escalate, keep your "reply" brief and reassuring (you don't need to solve it) — the system adds the hand-over message.

OUTPUT — respond with STRICT JSON only, no prose:
{"reply":"your message to the visitor","escalate":false,"reason":"short internal note"}`;
}

type ChatTurn = { sender: string; body: string };

// Collapse stored messages into a valid alternating user/assistant transcript.
function toMessages(turns: ChatTurn[]): { role: 'user' | 'assistant'; content: string }[] {
  const out: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const t of turns) {
    const role: 'user' | 'assistant' = t.sender === 'VISITOR' ? 'user' : 'assistant';
    const body = t.body.trim();
    if (!body) continue;
    const last = out[out.length - 1];
    if (last && last.role === role) last.content += `\n${body}`;
    else out.push({ role, content: body });
  }
  // Anthropic requires the first message to be from the user.
  while (out.length && out[0].role === 'assistant') out.shift();
  return out;
}

async function callHaiku(key: string, system: string, messages: { role: 'user' | 'assistant'; content: string }[]): Promise<{ reply: string; escalate: boolean; reason: string } | null> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: HAIKU,
        max_tokens: 400,
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages,
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) { console.error('[chat-ai] anthropic', res.status, await res.text().catch(() => '')); return null; }
    const j = await res.json();
    const text = j?.content?.find((c: { type: string }) => c.type === 'text')?.text ?? '';
    const obj = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    const reply = typeof obj.reply === 'string' ? obj.reply.trim().slice(0, 1200) : '';
    if (!reply) return null;
    return { reply, escalate: !!obj.escalate, reason: String(obj.reason || '').slice(0, 200) };
  } catch (e) {
    console.error('[chat-ai] call failed:', (e as Error)?.message);
    return null;
  }
}

// Hand the conversation to staff: flip to STAFF mode, post a hand-over note as
// the assistant, bump the unread badge and notify the clinic.
async function handOver(conversationId: string, visitorEmail: string | null, opening: string, reason: string) {
  const open = isOpenNow();
  const note = open
    ? `${opening} Let me bring in a member of our team — they'll reply right here in just a moment.`
    : `${opening} Our team isn't online at the moment (hours: ${hoursText()}). I've passed this to them and they'll follow up${visitorEmail ? ' by email' : ' here'} as soon as we reopen. In the meantime you can call ${site.phone} or book online at ${site.booking.path}.`;
  const handoverMsg = await db.chatMessage.create({ data: { conversationId, sender: 'AI', author: 'K (assistant)', body: note } });
  await db.chatConversation.update({ where: { id: conversationId }, data: { mode: 'STAFF', status: 'OPEN', lastMessageAt: new Date(), staffUnread: { increment: 1 } } });
  // In-app alert: a live visitor needs a person now (urgent, collapses per conversation).
  try {
    const { notifyStaffByPermission } = await import('@/lib/notifications');
    await notifyStaffByPermission('clients.view', {
      kind: 'comment', category: 'messages', priority: 'urgent',
      title: 'Live chat needs a person', body: (reason || 'A visitor asked for a human').slice(0, 140),
      href: `/admin/chat?c=${conversationId}`, groupKey: `chat:${conversationId}`,
    });
  } catch { /* non-fatal */ }
  // If the visitor left their email and has stepped away, email them this note too.
  try { const { emailChatMessage } = await import('@/lib/chat-email'); await emailChatMessage(handoverMsg.id); } catch { /* non-fatal */ }
  try {
    const { sendEmail } = await import('@/lib/email');
    await sendEmail({
      to: process.env.CLINIC_NOTIFY_EMAIL || site.email,
      subject: 'Live chat needs a human',
      html: `<p>The chat assistant handed a conversation to the team.</p><p><strong>Reason:</strong> ${reason.replace(/[<>]/g, '') || 'requested human'}</p>${visitorEmail ? `<p>Visitor email: ${visitorEmail}</p>` : ''}<p>Reply in the CRM → Live chat.</p>`,
    });
  } catch { /* non-fatal */ }
}

/**
 * Generate and store an AI reply for the latest visitor message, if the
 * conversation is in AI mode. Best-effort: any failure hands over to staff so a
 * visitor is never left without a path to a human. Safe to await or fire-and-forget.
 */
export async function maybeAutoReply(conversationId: string): Promise<void> {
  try {
    const convo = await db.chatConversation.findUnique({
      where: { id: conversationId },
      select: {
        mode: true, status: true, visitorEmail: true,
        messages: { orderBy: { createdAt: 'desc' }, take: MAX_HISTORY, select: { sender: true, body: true } },
      },
    });
    if (!convo || convo.mode !== 'AI' || convo.status === 'CLOSED') return; // staff is driving / closed

    const key = await getSecret('ANTHROPIC_API_KEY');
    if (!key) { await handOver(conversationId, convo.visitorEmail, 'Thanks for your message!', 'assistant unavailable'); return; }

    const turns = convo.messages.slice().reverse();
    const messages = toMessages(turns);
    if (!messages.length) return;

    const knowledge = await buildKnowledge();
    const result = await callHaiku(key, systemPrompt(knowledge, isOpenNow()), messages);

    if (!result) { await handOver(conversationId, convo.visitorEmail, 'Thanks for your message!', 'assistant error'); return; }

    if (result.escalate) {
      await handOver(conversationId, convo.visitorEmail, result.reply, result.reason || 'assistant escalated');
      return;
    }

    // Re-check mode in case staff jumped in while the model was thinking.
    const fresh = await db.chatConversation.findUnique({ where: { id: conversationId }, select: { mode: true } });
    if (fresh?.mode !== 'AI') return;
    const aiMsg = await db.chatMessage.create({ data: { conversationId, sender: 'AI', author: 'K (assistant)', body: result.reply } });
    await db.chatConversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });
    // Email the reply if the visitor left their email and has stepped away.
    try { const { emailChatMessage } = await import('@/lib/chat-email'); await emailChatMessage(aiMsg.id); } catch { /* non-fatal */ }
  } catch (e) {
    console.error('[chat-ai] maybeAutoReply failed:', (e as Error)?.message);
    try { await handOver(conversationId, null, 'Thanks for your message!', 'assistant exception'); } catch { /* give up */ }
  }
}
