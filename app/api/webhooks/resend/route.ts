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
  if (secret && !verify(secret, req.headers, body)) return new Response('bad signature', { status: 401 });

  let evt: { type?: string; data?: { email_id?: string } };
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
  return new Response('ok');
}
