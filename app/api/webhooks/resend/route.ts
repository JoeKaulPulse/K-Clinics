import crypto from 'node:crypto';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Resend delivery webhook → records open / click / bounce / complaint against the
// EmailEvent (matched by provider id) so the email dashboard can show real rates.
// Verifies the Svix signature when RESEND_WEBHOOK_SECRET is set.
function verify(secret: string, headers: Headers, body: string): boolean {
  try {
    const id = headers.get('svix-id'); const ts = headers.get('svix-timestamp'); const sig = headers.get('svix-signature');
    if (!id || !ts || !sig) return false;
    const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
    const expected = crypto.createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64');
    return sig.split(' ').some((s) => s.split(',')[1] === expected);
  } catch { return false; }
}

export async function POST(req: Request) {
  if (!crmEnabled) return new Response('ok');
  const body = await req.text();
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  // Fail closed whenever a real database is attached (prod AND previews): an
  // unsigned webhook could otherwise mark clients bounced/complained (→
  // unsubscribed) or skew metrics on a live or preview DB (BLD-279).
  if (!secret) {
    const { hasDatabase } = await import('@/lib/crm');
    if (hasDatabase) return new Response('webhook secret not configured', { status: 503 });
  } else if (!verify(secret, req.headers, body)) {
    return new Response('bad signature', { status: 401 });
  }

  let evt: { type?: string; data?: { email_id?: string; click?: { link?: string } } };
  try { evt = JSON.parse(body); } catch { return new Response('bad json', { status: 400 }); }
  const providerId = evt.data?.email_id;
  if (!providerId || !evt.type) return new Response('ok');

  const { db } = await import('@/lib/db');
  const now = new Date();
  const map: Record<string, Record<string, unknown>> = {
    'email.delivered': { status: 'SENT' },
    'email.opened': { openedAt: now, opens: { increment: 1 } },
    'email.clicked': { clickedAt: now, clicks: { increment: 1 } },
    'email.bounced': { bouncedAt: now, status: 'FAILED' },
    'email.complained': { complainedAt: now },
  };
  const data = map[evt.type];
  if (data) await db.emailEvent.updateMany({ where: { providerId }, data }).catch(() => {});

  // Record which link was clicked (per-campaign), for the link breakdown.
  if (evt.type === 'email.clicked' && evt.data?.click?.link) {
    try {
      const ev = await db.emailEvent.findFirst({ where: { providerId }, select: { campaignId: true } });
      if (ev?.campaignId) {
        const url = String(evt.data.click.link).slice(0, 500);
        await db.emailLinkClick.upsert({
          where: { campaignId_url: { campaignId: ev.campaignId, url } },
          update: { clicks: { increment: 1 } },
          create: { campaignId: ev.campaignId, url, clicks: 1 },
        });
      }
    } catch { /* non-fatal */ }
  }

  // List hygiene: a spam complaint or a hard bounce means we must stop emailing
  // this client — suppress them so they're excluded from every future send.
  if (evt.type === 'email.complained' || evt.type === 'email.bounced') {
    try {
      const ev = await db.emailEvent.findFirst({ where: { providerId }, select: { clientId: true } });
      if (ev?.clientId) await db.client.update({ where: { id: ev.clientId }, data: { unsubscribed: true, marketingOptIn: false } });
    } catch { /* non-fatal */ }
  }
  return new Response('ok');
}
