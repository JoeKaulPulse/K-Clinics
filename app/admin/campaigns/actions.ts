'use server';

import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';
import { getSession } from '@/lib/auth';

// Sends a broadcast to all opted-in, non-unsubscribed clients (optionally a tag).
export async function sendCampaign(formData: FormData) {
  if (!crmEnabled) return { ok: false, error: 'CRM disabled' };
  const session = await getSession();
  if (!session) return { ok: false, error: 'Unauthorised' };

  const name = String(formData.get('name') || '').trim();
  const subject = String(formData.get('subject') || '').trim();
  const body = String(formData.get('body') || '').trim();
  const tag = String(formData.get('segment') || '').trim();
  if (!name || !subject || !body) return { ok: false, error: 'All fields required' };

  const { db } = await import('@/lib/db');
  const { sendEmail, tmplManual } = await import('@/lib/email');

  const recipients = await db.client.findMany({
    where: { marketingOptIn: true, unsubscribed: false, ...(tag ? { tags: { has: tag } } : {}) },
  });

  const campaign = await db.campaign.create({ data: { name, subject, body, segment: tag || null } });

  let sent = 0;
  for (const c of recipients) {
    const unsubUrl = `${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/unsubscribe?t=${c.unsubToken}`;
    const greeting = body.replace(/\{firstName\}/g, c.firstName);
    const res = await sendEmail({ to: c.email, subject, html: tmplManual(greeting.replace(/\n/g, '<br>'), unsubUrl) });
    await db.emailEvent.create({
      data: { clientId: c.id, kind: 'CAMPAIGN', to: c.email, subject, status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error, meta: { campaignId: campaign.id } },
    });
    if (res.ok) sent++;
  }

  await db.campaign.update({ where: { id: campaign.id }, data: { sentAt: new Date(), recipients: sent } });
  revalidatePath('/admin/campaigns');
  return { ok: true, sent, total: recipients.length };
}
