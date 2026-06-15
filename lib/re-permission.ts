import 'server-only';
import { db } from '@/lib/db';
import { site } from '@/lib/site';
import { legacyOptInWhere, marketingConsentFields } from '@/lib/consent';

// BLD-242 follow-up — double opt-in re-permissioning. Legacy clients whose
// marketing opt-in predates the consent-evidence fields are now excluded from
// marketing (lib/consent.marketableClientWhere). This module emails them a
// single confirmation asking them to re-opt-in; clicking through records fresh
// consent evidence so they re-enter the marketable audience lawfully. The link
// is the client's existing unique unsubToken, and the actual consent is only
// written on an affirmative POST (a button click), never on link preview.

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || site.url).replace(/\/$/, '');
export const REPERMISSION_SOURCE = 'email-re-permission';

export function reconsentUrl(token: string): string {
  return `${SITE_URL}/api/marketing/reconsent?t=${encodeURIComponent(token)}`;
}

/** How many legacy opt-ins are still awaiting (or have never been sent) a
 *  re-permission email, and how many total legacy opt-ins exist. */
export async function repermissionStats(): Promise<{ pending: number; total: number }> {
  const [pending, total] = await Promise.all([
    db.client.count({ where: { ...legacyOptInWhere(), repermissionSentAt: null, email: { not: '' } } }),
    db.client.count({ where: legacyOptInWhere() }),
  ]);
  return { pending, total };
}

/** Record fresh marketing consent for the client behind a re-permission token.
 *  Idempotent; only acts on a still-legacy (no evidence) opt-in record. Returns
 *  the client's first name on success for the thank-you page, or null. */
export async function recordReconsent(token: string): Promise<{ ok: boolean; firstName?: string }> {
  if (!token) return { ok: false };
  const client = await db.client.findUnique({ where: { unsubToken: token }, select: { id: true, firstName: true, marketingConsentAt: true } }).catch(() => null);
  if (!client) return { ok: false };
  // Affirmative re-opt-in: set consent evidence, (re)enable marketing, clear any
  // prior unsubscribe since they've just explicitly asked to keep hearing from us.
  await db.client.update({
    where: { id: client.id },
    data: { marketingOptIn: true, unsubscribed: false, ...marketingConsentFields(REPERMISSION_SOURCE) },
  });
  return { ok: true, firstName: client.firstName || undefined };
}

/** Send the re-permission email to a bounded batch of legacy opt-ins that
 *  haven't been emailed yet. Idempotent per client via repermissionSentAt.
 *  Best-effort per recipient — one failure never aborts the batch. */
export async function sendRepermissionBatch(opts: { limit?: number } = {}): Promise<{ sent: number; failed: number; remaining: number }> {
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 500);
  const targets = await db.client.findMany({
    where: { ...legacyOptInWhere(), repermissionSentAt: null, email: { not: '' } },
    select: { id: true, firstName: true, email: true, unsubToken: true },
    take: limit,
  });

  const { sendEmail, emailShell } = await import('@/lib/email');
  let sent = 0, failed = 0;
  for (const c of targets) {
    const link = reconsentUrl(c.unsubToken);
    const unsubUrl = `${SITE_URL}/api/unsubscribe?t=${c.unsubToken}`;
    const body = `
      <p style="font-family:Helvetica,Arial,sans-serif;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:#a98a6d;margin:0 0 8px;">Stay in touch</p>
      <h1 style="margin:0 0 12px;font-size:25px;">Still want to hear from us, ${escapeHtml(c.firstName || 'there')}?</h1>
      <p style="margin:0 0 14px;">We're tidying our records to make sure we only email people who want our offers, news and skincare tips. To keep receiving them, just confirm below — it takes one tap.</p>
      <p style="margin:6px 0 18px;"><a href="${link}" style="display:inline-block;background:#a98a6d;color:#fff;text-decoration:none;padding:13px 26px;border-radius:999px;font-size:14px;">Yes, keep me subscribed</a></p>
      <p style="font-size:13px;color:#91766e;">If you'd rather not, no action is needed — you simply won't hear from us. You can also <a href="${unsubUrl}" style="color:#91766e;">unsubscribe here</a>.</p>`;
    try {
      const res = await sendEmail({
        to: c.email,
        subject: 'Still want to hear from KClinics?',
        html: emailShell({ body, preheader: 'Confirm your email preferences to keep receiving our offers and news.', unsubUrl }),
        headers: { 'List-Unsubscribe': `<${unsubUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      });
      if (res.ok) sent += 1; else failed += 1;
    } catch { failed += 1; }
    // Mark as contacted regardless of send result so a transient bounce doesn't
    // cause repeated re-sends; failures are visible in the returned count.
    await db.client.update({ where: { id: c.id }, data: { repermissionSentAt: new Date() } }).catch(() => {});
  }

  const remaining = await db.client.count({ where: { ...legacyOptInWhere(), repermissionSentAt: null, email: { not: '' } } });
  return { sent, failed, remaining };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}
