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

  // Optional per-recipient discount: when set, each recipient gets a unique code
  // merged into the email via the {discountCode} placeholder.
  const discountOn = String(formData.get('discountOn') || '') === 'on';
  const discountType = String(formData.get('discountType') || 'PERCENT') === 'FIXED' ? 'FIXED' : 'PERCENT';
  const discountValue = Math.round(Number(formData.get('discountValue')) || 0);
  const discountDays = Math.round(Number(formData.get('discountDays')) || 14);
  if (discountOn && discountValue <= 0) return { ok: false, error: 'Enter a discount value.' };
  if (discountOn && !/\{discountCode\}/.test(body)) return { ok: false, error: 'Add {discountCode} to the message so each recipient gets their code.' };

  const { db } = await import('@/lib/db');
  const { sendEmail, tmplManual } = await import('@/lib/email');
  const { marketableClientWhere } = await import('@/lib/consent');

  // BLD-242: only clients with recorded marketing-consent evidence (UK GDPR Art.7).
  const recipients = await db.client.findMany({
    where: { ...marketableClientWhere(), ...(tag ? { tags: { has: tag } } : {}) },
  });

  const campaign = await db.campaign.create({ data: { name, subject, body, segment: tag || null } });
  const { createPersonalCode } = discountOn ? await import('@/lib/promo') : { createPersonalCode: null };
  const codeExpiry = discountOn ? new Date(Date.now() + discountDays * 864e5) : null;

  let sent = 0;
  for (const c of recipients) {
    const unsubUrl = `${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/unsubscribe?t=${c.unsubToken}`;
    let greeting = body.replace(/\{firstName\}/g, c.firstName);
    if (discountOn && createPersonalCode) {
      try {
        const code = await createPersonalCode({ campaignId: campaign.id, email: c.email, discountType, percent: discountType === 'PERCENT' ? discountValue : undefined, amountPence: discountType === 'FIXED' ? discountValue * 100 : undefined, expiresAt: codeExpiry, label: name });
        greeting = greeting.replace(/\{discountCode\}/g, code);
      } catch { greeting = greeting.replace(/\{discountCode\}/g, ''); }
    }
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
