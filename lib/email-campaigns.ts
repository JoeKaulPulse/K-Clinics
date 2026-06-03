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

type SendOpts = {
  subject: string;
  blocks: EmailBlock[];
  audience: Audience;
  campaignId: string;
  fromName?: string;
  replyTo?: string;
  preheader?: string;
};

/** Personalise + deliver a campaign to its whole audience with bounded
 *  concurrency, recording a per-recipient EmailEvent. Each send is isolated so
 *  one failure never aborts the batch. */
export async function deliverCampaign(opts: SendOpts): Promise<{ sent: number; failed: number }> {
  const { subject, blocks, audience, campaignId } = opts;
  const preheader = opts.preheader?.trim() || subject;
  const bodyHtml = emailBlocksToHtml(blocks);
  const recipients = await db.client.findMany({
    where: await audienceWhere(audience),
    select: { id: true, email: true, firstName: true, lastName: true, unsubToken: true },
    take: 5000,
  });

  let sent = 0, failed = 0;
  const CONCURRENCY = 8;
  async function one(c: (typeof recipients)[number]) {
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
    await db.emailEvent.create({ data: { clientId: c.id, kind: 'CAMPAIGN', to: c.email, subject: subjectR, status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error, campaignId } }).catch(() => {});
  }
  for (let i = 0; i < recipients.length; i += CONCURRENCY) {
    await Promise.all(recipients.slice(i, i + CONCURRENCY).map(one));
  }
  return { sent, failed };
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

/** Cron entrypoint: send every scheduled campaign whose time has come. */
export async function dispatchDueCampaigns(): Promise<{ processed: number; sent: number }> {
  const due = await db.campaign.findMany({ where: { status: 'SCHEDULED', scheduledAt: { lte: new Date() } }, select: { id: true }, take: 25 });
  let sent = 0;
  for (const d of due) {
    try { const r = await sendCampaignById(d.id); sent += r.sent || 0; }
    catch (e) { console.error('[email-cron] campaign', d.id, 'failed:', (e as Error)?.message); }
  }
  return { processed: due.length, sent };
}
