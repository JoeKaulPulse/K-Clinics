'use server';

import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan } from '@/lib/auth';

// Live recipient count for the send-confirmation dialog (BLD-1352) — mirrors
// the same lawful-basis filtering `sendCampaign` below uses, so the number
// shown before sending matches who actually receives it. Reuses the audience
// helper from the richer campaign editor (lib/email-campaigns.ts) rather than
// re-deriving the where-clause here.
export async function previewCampaignAudience(tag: string): Promise<number> {
  if (!crmEnabled) return 0;
  const session = await getSession();
  // Pre-merge review fix: a Server Action is a public POST endpoint, so the
  // `campaigns.view` redirect on app/admin/campaigns/page.tsx does not gate it.
  // Without this, any signed-in staff session — including DEVELOPER and
  // CONTRACTOR, which are given no client access at all (lib/permissions.ts) —
  // could read the size of the marketable client list.
  if (!sessionCan(session, 'campaigns.view')) return 0;
  const { countAudience } = await import('@/lib/email-campaigns');
  const t = tag.trim();
  return countAudience(t ? { type: 'tag', value: t } : { type: 'all' });
}

// Sends a broadcast to all opted-in, non-unsubscribed clients (optionally a tag).
export async function sendCampaign(formData: FormData) {
  if (!crmEnabled) return { ok: false, error: 'CRM disabled' };
  const session = await getSession();
  // Pre-merge review fix, same reasoning as previewCampaignAudience above but
  // with far more at stake: this action checked only that SOME staff session
  // existed, so any signed-in account could broadcast arbitrary content to
  // every marketable client. The rich composer's route has always required
  // `campaigns.send` (app/api/admin/marketing/email/send/route.ts); this legacy
  // one never did. Every role that can reach the page (OWNER, ADMIN) already
  // holds `campaigns.send` by default, so nobody who could legitimately send
  // loses the ability to.
  if (!sessionCan(session, 'campaigns.send')) return { ok: false, error: 'You don’t have permission to send campaigns.' };

  const name = String(formData.get('name') || '').trim();
  const subject = String(formData.get('subject') || '').trim();
  const body = String(formData.get('body') || '').trim();
  const tag = String(formData.get('segment') || '').trim();
  if (!name || !subject || !body) return { ok: false, error: 'All fields required' };

  // Optional per-recipient discount: when set, each recipient gets a unique code
  // merged into the email via the {discountCode} placeholder.
  const discountOn = String(formData.get('discountOn') || '') === 'on';
  const discountType = String(formData.get('discountType') || 'PERCENT') === 'FIXED' ? 'FIXED' : 'PERCENT';
  const discountValue = Math.round(Number(formData.get('discountValue')) || 0);
  const discountDays = Math.round(Number(formData.get('discountDays')) || 14);
  if (discountOn && discountValue <= 0) return { ok: false, error: 'Enter a discount value.' };
  if (discountOn && !/\{discountCode\}/.test(body)) return { ok: false, error: 'Add {discountCode} to the message so each recipient gets their code.' };

  const { db } = await import('@/lib/db');

  // BLD-1832: previously this created the campaign with no explicit status
  // (defaulting to 'SENT' per the schema) and then emailed every recipient
  // in a single serial loop with no batching. A list large enough to outrun
  // this action's time budget left the loop dead mid-send with campaign.sentAt
  // still null and no record that anything was in flight — a silent partial
  // send. It now starts SENDING (visible in the History list as "sending…"
  // until it finishes) and hands the actual delivery to deliverPlainCampaign,
  // which batches with bounded concurrency and records an EmailEvent per
  // recipient immediately. Discount terms are persisted on the row (not just
  // held in this function's closure) so resumeStuckPlainCampaigns — the cron
  // sweep in lib/email-campaigns.ts that finishes any campaign still SENDING
  // after 30 minutes — can mint the remaining codes with the same terms.
  const campaign = await db.campaign.create({
    data: {
      name, subject, body, segment: tag || null, status: 'SENDING', format: 'text',
      discountType: discountOn ? discountType : null,
      discountValue: discountOn ? discountValue : null,
      discountExpiresAt: discountOn ? new Date(Date.now() + discountDays * 864e5) : null,
    },
  });

  const { deliverPlainCampaign } = await import('@/lib/email-campaigns');
  const { sent, failed } = await deliverPlainCampaign(campaign);

  await db.campaign.update({ where: { id: campaign.id }, data: { status: 'SENT', sentAt: new Date(), recipients: sent } });
  revalidatePath('/admin/campaigns');
  return { ok: true, sent, total: sent + failed };
}
