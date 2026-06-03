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
  const { db } = await import('@/lib/db');

  // Compliance: every audience is restricted to opted-in, non-unsubscribed
  // clients. Shared by the count preview and the real send.
  async function audienceWhere(): Promise<Record<string, unknown>> {
    let where: Record<string, unknown> = { marketingOptIn: true, unsubscribed: false };
    const aud = body.audience || { type: 'all' };
    if (aud.type === 'tag' && aud.value) where = { ...where, tags: { has: String(aud.value) } };
    if (aud.type === 'segment' && aud.value) {
      const seg = await db.segment.findUnique({ where: { id: String(aud.value) } });
      if (seg) { const { rulesToWhere } = await import('@/lib/segments'); where = { ...where, ...rulesToWhere(seg.rules as Record<string, unknown>) }; }
    }
    return where;
  }

  // ── Audience-size preview — count only, no send (lets the composer show how
  //    many people a campaign will reach before the user commits). ──
  if (body.op === 'count') {
    const count = await db.client.count({ where: await audienceWhere() });
    return NextResponse.json({ ok: true, count });
  }

  const subject = String(body.subject || '').trim().slice(0, 200);
  const name = String(body.name || subject || 'Email').slice(0, 120);
  const blocks = Array.isArray(body.blocks) ? body.blocks : [];
  if (!subject || blocks.length === 0) return NextResponse.json({ ok: false, error: 'Add a subject and some content.' }, { status: 400 });

  // Sender controls (optional) — display name, reply-to and a separate preheader.
  const fromName = String(body.fromName || '').trim().slice(0, 80) || undefined;
  const replyTo = String(body.replyTo || '').trim().slice(0, 120) || undefined;
  const preheader = String(body.preheader || '').trim().slice(0, 160) || subject;

  const { emailBlocksToHtml, applyMergeTags } = await import('@/lib/email-builder');
  const { sendEmail, emailShell } = await import('@/lib/email');
  const bodyHtml = emailBlocksToHtml(blocks);

  // Test send — no records, no audience. Merge tags resolve to sample values.
  if (body.test) {
    const to = String(body.test).trim();
    if (!to) return NextResponse.json({ ok: false, error: 'Enter a test address.' }, { status: 400 });
    const sample = { first_name: 'Alex', last_name: 'Taylor', email: to };
    const res = await sendEmail({
      to,
      subject: `[Test] ${applyMergeTags(subject, sample)}`,
      html: emailShell({ body: applyMergeTags(bodyHtml, sample), preheader: applyMergeTags(preheader, sample) }),
      fromName, replyTo,
    });
    return res.ok ? NextResponse.json({ ok: true, test: true }) : NextResponse.json({ ok: false, error: res.error }, { status: 502 });
  }

  const recipients = await db.client.findMany({ where: await audienceWhere(), select: { id: true, email: true, firstName: true, lastName: true, unsubToken: true }, take: 5000 });
  if (recipients.length === 0) return NextResponse.json({ ok: false, error: 'No opted-in recipients match that audience.' }, { status: 400 });

  const aud = body.audience || { type: 'all' };
  const campaign = await db.campaign.create({ data: { name, subject, body: JSON.stringify(blocks), segment: aud.type === 'all' ? null : String(aud.value || '') } });

  // Send with bounded concurrency so large audiences don't run serially (and
  // time out). Each send is wrapped so a thrown error counts as a failure for
  // that recipient rather than aborting the whole campaign half-way. Subject,
  // body and preheader are personalised per recipient.
  let sent = 0, failed = 0;
  const CONCURRENCY = 8;
  async function deliver(c: (typeof recipients)[number]) {
    const ctx = { first_name: c.firstName || '', last_name: c.lastName || '', email: c.email };
    const subjectR = applyMergeTags(subject, ctx);
    const html = emailShell({ body: applyMergeTags(bodyHtml, ctx), preheader: applyMergeTags(preheader, ctx), unsubUrl: `${SITE}/api/unsubscribe?t=${c.unsubToken}` });
    let res: { ok: boolean; id?: string; error?: string };
    try {
      res = await sendEmail({ to: c.email, subject: subjectR, html, fromName, replyTo });
    } catch (e) {
      res = { ok: false, error: (e as Error)?.message?.slice(0, 200) || 'Send failed.' };
    }
    res.ok ? sent++ : failed++;
    await db.emailEvent.create({ data: { clientId: c.id, kind: 'CAMPAIGN', to: c.email, subject: subjectR, status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error, campaignId: campaign.id } }).catch(() => {});
  }
  for (let i = 0; i < recipients.length; i += CONCURRENCY) {
    await Promise.all(recipients.slice(i, i + CONCURRENCY).map(deliver));
  }

  await db.campaign.update({ where: { id: campaign.id }, data: { sentAt: new Date(), recipients: sent } }).catch(() => {});
  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Sent email “${name}” to ${sent} recipient(s)` });
  return NextResponse.json({ ok: true, sent, failed, campaignId: campaign.id });
}
