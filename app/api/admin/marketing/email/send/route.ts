import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';
import { site } from '@/lib/site';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || site.url).replace(/\/$/, '');

// Send a visual-builder email to an audience via Resend, recording per-recipient
// EmailEvents for analytics. Requires campaigns.send.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('campaigns.send');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const subject = String(body.subject || '').trim().slice(0, 200);
  const name = String(body.name || subject || 'Email').slice(0, 120);
  const blocks = Array.isArray(body.blocks) ? body.blocks : [];
  if (!subject || blocks.length === 0) return NextResponse.json({ ok: false, error: 'Add a subject and some content.' }, { status: 400 });

  const { emailBlocksToHtml } = await import('@/lib/email-builder');
  const { sendEmail, emailShell } = await import('@/lib/email');
  const bodyHtml = emailBlocksToHtml(blocks);

  // Test send — no records, no audience.
  if (body.test) {
    const to = String(body.test).trim();
    if (!to) return NextResponse.json({ ok: false, error: 'Enter a test address.' }, { status: 400 });
    const res = await sendEmail({ to, subject: `[Test] ${subject}`, html: emailShell({ body: bodyHtml, preheader: subject }) });
    return res.ok ? NextResponse.json({ ok: true, test: true }) : NextResponse.json({ ok: false, error: res.error }, { status: 502 });
  }

  // Resolve the audience — always opted-in & not unsubscribed (compliance).
  const { db } = await import('@/lib/db');
  let where: Record<string, unknown> = { marketingOptIn: true, unsubscribed: false };
  const aud = body.audience || { type: 'all' };
  if (aud.type === 'tag' && aud.value) where = { ...where, tags: { has: String(aud.value) } };
  if (aud.type === 'segment' && aud.value) {
    const seg = await db.segment.findUnique({ where: { id: String(aud.value) } });
    if (seg) { const { rulesToWhere } = await import('@/lib/segments'); where = { ...where, ...rulesToWhere(seg.rules as Record<string, unknown>) }; }
  }
  const recipients = await db.client.findMany({ where, select: { id: true, email: true, firstName: true, unsubToken: true }, take: 5000 });
  if (recipients.length === 0) return NextResponse.json({ ok: false, error: 'No opted-in recipients match that audience.' }, { status: 400 });

  const campaign = await db.campaign.create({ data: { name, subject, body: JSON.stringify(blocks), segment: aud.type === 'all' ? null : String(aud.value || '') } });

  // Send with bounded concurrency so large audiences don't run serially (and
  // time out). Each send is wrapped so a thrown error counts as a failure for
  // that recipient rather than aborting the whole campaign half-way.
  let sent = 0, failed = 0;
  const CONCURRENCY = 8;
  async function deliver(c: (typeof recipients)[number]) {
    const html = emailShell({ body: bodyHtml, preheader: subject, unsubUrl: `${SITE}/api/unsubscribe?t=${c.unsubToken}` });
    let res: { ok: boolean; id?: string; error?: string };
    try {
      res = await sendEmail({ to: c.email, subject, html });
    } catch (e) {
      res = { ok: false, error: (e as Error)?.message?.slice(0, 200) || 'Send failed.' };
    }
    res.ok ? sent++ : failed++;
    await db.emailEvent.create({ data: { clientId: c.id, kind: 'CAMPAIGN', to: c.email, subject, status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error, campaignId: campaign.id } }).catch(() => {});
  }
  for (let i = 0; i < recipients.length; i += CONCURRENCY) {
    await Promise.all(recipients.slice(i, i + CONCURRENCY).map(deliver));
  }

  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Sent email “${name}” to ${sent} recipient(s)` });
  return NextResponse.json({ ok: true, sent, failed, campaignId: campaign.id });
}
