import 'server-only';
import { db } from '@/lib/db';
import { site } from '@/lib/site';
import { sendEmail, emailShell } from '@/lib/email';
import { emailBlocksToHtml, applyMergeTags, type EmailBlock } from '@/lib/email-builder';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || site.url).replace(/\/$/, '');

export type Audience = { type: 'all' | 'segment' | 'tag'; value?: string };

/** Build the Prisma where-clause for an audience. Always restricted to
 *  opted-in, non-unsubscribed clients (marketing compliance). */
export async function audienceWhere(aud: Audience): Promise<Record<string, unknown>> {
  let where: Record<string, unknown> = { marketingOptIn: true, unsubscribed: false };
  if (aud.type === 'tag' && aud.value) where = { ...where, tags: { has: String(aud.value) } };
  if (aud.type === 'segment' && aud.value) {
    const seg = await db.segment.findUnique({ where: { id: String(aud.value) } });
    if (seg) { const { rulesToWhere } = await import('@/lib/segments'); where = { ...where, ...rulesToWhere(seg.rules as Record<string, unknown>) }; }
  }
  return where;
}

export const countAudience = async (aud: Audience): Promise<number> => db.client.count({ where: await audienceWhere(aud) });

type Recipient = { id: string; email: string; firstName: string | null; lastName: string | null; unsubToken: string };

type DeliverOpts = {
  subject: string;
  blocks: EmailBlock[];
  campaignId: string;
  fromName?: string;
  replyTo?: string;
  preheader?: string;
  meta?: Record<string, unknown>; // recorded on each EmailEvent (e.g. A/B variant)
};

const RECIPIENT_SELECT = { id: true, email: true, firstName: true, lastName: true, unsubToken: true } as const;

/** Personalise + deliver to an explicit list of recipients with bounded
 *  concurrency. Each send is isolated so one failure never aborts the batch. */
export async function deliverToRecipients(recipients: Recipient[], opts: DeliverOpts): Promise<{ sent: number; failed: number }> {
  const { subject, blocks, campaignId } = opts;
  const preheader = opts.preheader?.trim() || subject;
  const bodyHtml = emailBlocksToHtml(blocks);

  let sent = 0, failed = 0;
  const CONCURRENCY = 8;
  async function one(c: Recipient) {
    const ctx = { first_name: c.firstName || '', last_name: c.lastName || '', email: c.email };
    const subjectR = applyMergeTags(subject, ctx);
    const unsubUrl = `${SITE}/api/unsubscribe?t=${c.unsubToken}`;
    const html = emailShell({ body: applyMergeTags(bodyHtml, ctx), preheader: applyMergeTags(preheader, ctx), unsubUrl });
    // RFC 8058 one-click unsubscribe — now required by Gmail/Yahoo for bulk
    // senders and a strong deliverability signal.
    const headers = { 'List-Unsubscribe': `<${unsubUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' };
    let res: { ok: boolean; id?: string; error?: string };
    try {
      res = await sendEmail({ to: c.email, subject: subjectR, html, fromName: opts.fromName, replyTo: opts.replyTo, headers });
    } catch (e) {
      res = { ok: false, error: (e as Error)?.message?.slice(0, 200) || 'Send failed.' };
    }
    res.ok ? sent++ : failed++;
    await db.emailEvent.create({ data: { clientId: c.id, kind: 'CAMPAIGN', to: c.email, subject: subjectR, status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error, campaignId, meta: opts.meta as object | undefined } }).catch(() => {});
  }
  for (let i = 0; i < recipients.length; i += CONCURRENCY) {
    await Promise.all(recipients.slice(i, i + CONCURRENCY).map(one));
  }
  return { sent, failed };
}

/** Personalise + deliver a campaign to its whole audience. */
export async function deliverCampaign(opts: DeliverOpts & { audience: Audience }): Promise<{ sent: number; failed: number }> {
  const recipients = await db.client.findMany({ where: await audienceWhere(opts.audience), select: RECIPIENT_SELECT, take: 5000 });
  return deliverToRecipients(recipients, opts);
}

/** Send an already-persisted campaign now (draft or scheduled → SENT). Guards
 *  against double-sends by flipping status to SENDING first. */
export async function sendCampaignById(id: string): Promise<{ ok: boolean; sent?: number; failed?: number; error?: string }> {
  const c = await db.campaign.findUnique({ where: { id } });
  if (!c) return { ok: false, error: 'Campaign not found.' };
  if (c.status === 'SENT' || c.status === 'SENDING') return { ok: false, error: 'This campaign has already been sent.' };
  // Claim it so a concurrent cron/click can't send it twice.
  await db.campaign.update({ where: { id }, data: { status: 'SENDING' } });
  let blocks: EmailBlock[] = [];
  try { blocks = JSON.parse(c.body) as EmailBlock[]; } catch { /* empty */ }
  const { sent, failed } = await deliverCampaign({
    subject: c.subject, blocks, campaignId: id,
    audience: { type: (c.audienceType as Audience['type']) || 'all', value: c.audienceValue || undefined },
    fromName: c.fromName || undefined, replyTo: c.replyTo || undefined, preheader: c.preheader || undefined,
  });
  await db.campaign.update({ where: { id }, data: { status: 'SENT', sentAt: new Date(), recipients: sent } });
  return { ok: true, sent, failed };
}

const shuffle = <T>(arr: T[]): T[] => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** Start an A/B subject test: send subject A and subject B each to a random
 *  sample of the audience, then schedule a winner decision. Falls back to a
 *  normal send when the audience is too small to test meaningfully. */
export async function startAbTest(id: string): Promise<{ ok: boolean; error?: string; tested?: number; testing?: boolean }> {
  const c = await db.campaign.findUnique({ where: { id } });
  if (!c) return { ok: false, error: 'Campaign not found.' };
  if (!c.subjectB) return { ok: false, error: 'Add a second subject line to A/B test.' };
  if (c.status === 'SENT' || c.status === 'SENDING' || c.status === 'AB_TESTING') return { ok: false, error: 'This campaign is already sending.' };
  await db.campaign.update({ where: { id }, data: { status: 'SENDING' } });

  let blocks: EmailBlock[] = [];
  try { blocks = JSON.parse(c.body) as EmailBlock[]; } catch { /* empty */ }
  const audience: Audience = { type: (c.audienceType as Audience['type']) || 'all', value: c.audienceValue || undefined };
  const common = { blocks, campaignId: id, fromName: c.fromName || undefined, replyTo: c.replyTo || undefined, preheader: c.preheader || undefined };
  const all = shuffle(await db.client.findMany({ where: await audienceWhere(audience), select: RECIPIENT_SELECT, take: 5000 }));

  const pct = Math.min(45, Math.max(5, c.abSamplePct ?? 15));
  const n = Math.floor((all.length * pct) / 100);
  // Need at least one in each sample AND someone left to receive the winner.
  if (n < 1 || all.length < 3 || 2 * n >= all.length) {
    const { sent } = await deliverToRecipients(all, { ...common, subject: c.subject });
    await db.campaign.update({ where: { id }, data: { status: 'SENT', sentAt: new Date(), recipients: sent, abWinner: 'A' } });
    return { ok: true, testing: false, tested: 0 };
  }

  const aSample = all.slice(0, n);
  const bSample = all.slice(n, 2 * n);
  await deliverToRecipients(aSample, { ...common, subject: c.subject, meta: { variant: 'A', phase: 'test' } });
  await deliverToRecipients(bSample, { ...common, subject: c.subjectB, meta: { variant: 'B', phase: 'test' } });
  await db.campaign.update({ where: { id }, data: { status: 'AB_TESTING', recipients: aSample.length + bSample.length } });
  return { ok: true, testing: true, tested: aSample.length + bSample.length };
}

/** Decide an A/B test by open rate and send the winning subject to everyone who
 *  hasn't been emailed yet. */
export async function decideAbTest(id: string): Promise<{ ok: boolean; error?: string; winner?: string; sent?: number }> {
  const c = await db.campaign.findUnique({ where: { id } });
  if (!c || c.status !== 'AB_TESTING') return { ok: false, error: 'Not in testing.' };
  await db.campaign.update({ where: { id }, data: { status: 'SENDING' } });

  const rate = async (variant: 'A' | 'B') => {
    const where = { campaignId: id, status: 'SENT' as const, meta: { path: ['variant'], equals: variant } };
    const sent = await db.emailEvent.count({ where });
    if (sent === 0) return -1; // no data for this variant
    const opened = await db.emailEvent.count({ where: { ...where, openedAt: { not: null } } });
    return opened / sent;
  };
  const [ra, rb] = await Promise.all([rate('A'), rate('B')]);
  const winner: 'A' | 'B' = rb > ra ? 'B' : 'A'; // ties / no-data favour A
  const winningSubject = winner === 'B' ? (c.subjectB || c.subject) : c.subject;

  let blocks: EmailBlock[] = [];
  try { blocks = JSON.parse(c.body) as EmailBlock[]; } catch { /* empty */ }
  const audience: Audience = { type: (c.audienceType as Audience['type']) || 'all', value: c.audienceValue || undefined };

  // Everyone in the audience who hasn't already been emailed for this campaign.
  const already = new Set((await db.emailEvent.findMany({ where: { campaignId: id }, select: { to: true } })).map((e) => e.to.toLowerCase()));
  const rest = (await db.client.findMany({ where: await audienceWhere(audience), select: RECIPIENT_SELECT, take: 5000 }))
    .filter((r) => !already.has(r.email.toLowerCase()));

  const { sent } = await deliverToRecipients(rest, {
    subject: winningSubject, blocks, campaignId: id,
    fromName: c.fromName || undefined, replyTo: c.replyTo || undefined, preheader: c.preheader || undefined,
    meta: { variant: winner, phase: 'winner' },
  });
  await db.campaign.update({ where: { id }, data: { status: 'SENT', sentAt: new Date(), abWinner: winner, recipients: c.recipients + sent } });
  return { ok: true, winner, sent };
}

/** Cron entrypoint: send scheduled campaigns whose time has come, and decide any
 *  A/B tests whose decision window has elapsed. */
export async function dispatchDueCampaigns(): Promise<{ processed: number; sent: number; abDecided: number }> {
  const now = new Date();
  const due = await db.campaign.findMany({ where: { status: 'SCHEDULED', scheduledAt: { lte: now } }, select: { id: true }, take: 25 });
  let sent = 0;
  for (const d of due) {
    try { const r = await sendCampaignById(d.id); sent += r.sent || 0; }
    catch (e) { console.error('[email-cron] campaign', d.id, 'failed:', (e as Error)?.message); }
  }
  const abDue = await db.campaign.findMany({ where: { status: 'AB_TESTING', abDecideAt: { lte: now } }, select: { id: true }, take: 25 });
  let abDecided = 0;
  for (const d of abDue) {
    try { const r = await decideAbTest(d.id); if (r.ok) { abDecided++; sent += r.sent || 0; } }
    catch (e) { console.error('[email-cron] A/B decide', d.id, 'failed:', (e as Error)?.message); }
  }
  return { processed: due.length, sent, abDecided };
}
