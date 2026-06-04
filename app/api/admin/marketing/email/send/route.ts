import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';
import type { Audience } from '@/lib/email-campaigns';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Email campaign operations: count audience, test, save draft, schedule, send
// now, delete and immediate send. Requires campaigns.send.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('campaigns.send');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');
  const { countAudience, deliverCampaign, sendCampaignById } = await import('@/lib/email-campaigns');
  const aud: Audience = body.audience || { type: 'all' };

  // ── Audience-size preview — count only, no send. ──
  if (body.op === 'count') {
    return NextResponse.json({ ok: true, count: await countAudience(aud) });
  }

  // ── Send an existing persisted campaign now (from the drafts/scheduled list). ──
  if (body.op === 'sendNow') {
    if (!body.id) return NextResponse.json({ ok: false, error: 'Missing id.' }, { status: 400 });
    const r = await sendCampaignById(String(body.id));
    if (r.ok) {
      const { logAudit } = await import('@/lib/audit');
      await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Sent campaign to ${r.sent} recipient(s)` });
    }
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }

  // ── Delete a draft / cancel a scheduled send. (Won't delete a sent campaign's
  //    history, which carries analytics.) ──
  if (body.op === 'delete') {
    if (!body.id) return NextResponse.json({ ok: false, error: 'Missing id.' }, { status: 400 });
    const c = await db.campaign.findUnique({ where: { id: String(body.id) }, select: { status: true } });
    if (!c) return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });
    if (c.status === 'SENT' || c.status === 'SENDING') return NextResponse.json({ ok: false, error: 'You can’t delete a campaign that has been sent.' }, { status: 400 });
    await db.campaign.delete({ where: { id: String(body.id) } });
    return NextResponse.json({ ok: true });
  }

  // Validate content for the remaining ops (test / draft / schedule / send).
  const subject = String(body.subject || '').trim().slice(0, 200);
  const name = String(body.name || subject || 'Email').slice(0, 120);
  const blocks = Array.isArray(body.blocks) ? body.blocks : [];
  const fromName = String(body.fromName || '').trim().slice(0, 80) || undefined;
  const replyTo = String(body.replyTo || '').trim().slice(0, 120) || undefined;
  const preheader = String(body.preheader || '').trim().slice(0, 160) || undefined;

  // ── Test send — no records, no audience. Merge tags resolve to sample values. ──
  if (body.test) {
    if (!subject || blocks.length === 0) return NextResponse.json({ ok: false, error: 'Add a subject and some content.' }, { status: 400 });
    const to = String(body.test).trim();
    if (!to) return NextResponse.json({ ok: false, error: 'Enter a test address.' }, { status: 400 });
    const { emailBlocksToHtml, applyMergeTags } = await import('@/lib/email-builder');
    const { sendEmail, emailShell } = await import('@/lib/email');
    const sample = { first_name: 'Alex', last_name: 'Taylor', email: to };
    const bodyHtml = emailBlocksToHtml(blocks);
    const res = await sendEmail({
      to,
      subject: `[Test] ${applyMergeTags(subject, sample)}`,
      html: emailShell({ body: applyMergeTags(bodyHtml, sample), preheader: applyMergeTags(preheader || subject, sample) }),
      fromName, replyTo,
    });
    return res.ok ? NextResponse.json({ ok: true, test: true }) : NextResponse.json({ ok: false, error: res.error }, { status: 502 });
  }

  // Persisted fields shared by draft / schedule / send.
  const persisted = {
    name, subject, body: JSON.stringify(blocks),
    segment: aud.type === 'all' ? null : String(aud.value || ''),
    audienceType: aud.type, audienceValue: aud.value || null,
    fromName: fromName || null, replyTo: replyTo || null, preheader: preheader || null,
  };
  const upsert = async (status: string, extra: Record<string, unknown> = {}) =>
    body.id
      ? db.campaign.update({ where: { id: String(body.id) }, data: { ...persisted, status, ...extra } })
      : db.campaign.create({ data: { ...persisted, status, createdBy: session.email, ...extra } });

  // ── Save as draft (no content requirement beyond a name/subject so partial
  //    work isn't lost). ──
  if (body.op === 'saveDraft') {
    const c = await upsert('DRAFT', { scheduledAt: null });
    return NextResponse.json({ ok: true, id: c.id });
  }

  // ── Schedule for a future time. ──
  if (body.op === 'schedule') {
    if (!subject || blocks.length === 0) return NextResponse.json({ ok: false, error: 'Add a subject and some content.' }, { status: 400 });
    const when = body.scheduledAt ? new Date(String(body.scheduledAt)) : null;
    if (!when || isNaN(+when)) return NextResponse.json({ ok: false, error: 'Choose a valid date and time.' }, { status: 400 });
    if (when.getTime() < Date.now() + 60_000) return NextResponse.json({ ok: false, error: 'Pick a time at least a minute from now.' }, { status: 400 });
    const c = await upsert('SCHEDULED', { scheduledAt: when });
    const { logAudit } = await import('@/lib/audit');
    await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Scheduled email “${name}” for ${when.toLocaleString('en-GB')}` });
    return NextResponse.json({ ok: true, id: c.id, scheduledAt: when.toISOString() });
  }

  // ── Start an A/B subject test: two subjects to samples, winner to the rest. ──
  if (body.op === 'abTest') {
    if (!subject || blocks.length === 0) return NextResponse.json({ ok: false, error: 'Add a subject and some content.' }, { status: 400 });
    const subjectB = String(body.subjectB || '').trim().slice(0, 200);
    if (!subjectB) return NextResponse.json({ ok: false, error: 'Add a second subject line (B) to test.' }, { status: 400 });
    if ((await countAudience(aud)) < 3) return NextResponse.json({ ok: false, error: 'Need at least a few opted-in recipients to run a test.' }, { status: 400 });
    const samplePct = Math.min(45, Math.max(5, Math.round(Number(body.abSamplePct) || 15)));
    const hours = Math.min(72, Math.max(1, Math.round(Number(body.abWindowHours) || 4)));
    const decideAt = new Date(Date.now() + hours * 3600_000);
    const c = await upsert('DRAFT', { subjectB, abSamplePct: samplePct, abDecideAt: decideAt });
    const { startAbTest } = await import('@/lib/email-campaigns');
    const r = await startAbTest(c.id);
    if (!r.ok) return NextResponse.json(r, { status: 400 });
    const { logAudit } = await import('@/lib/audit');
    await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Started A/B email “${name}” (${r.tested} tested)` });
    return NextResponse.json({ id: c.id, ...r, decideAt: decideAt.toISOString() });
  }

  // ── Send immediately. ──
  if (!subject || blocks.length === 0) return NextResponse.json({ ok: false, error: 'Add a subject and some content.' }, { status: 400 });
  if ((await countAudience(aud)) === 0) return NextResponse.json({ ok: false, error: 'No opted-in recipients match that audience.' }, { status: 400 });

  const campaign = await upsert('SENDING');
  const { sent, failed } = await deliverCampaign({ subject, blocks, audience: aud, campaignId: campaign.id, fromName, replyTo, preheader });
  await db.campaign.update({ where: { id: campaign.id }, data: { status: 'SENT', sentAt: new Date(), recipients: sent } }).catch(() => {});

  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Sent email “${name}” to ${sent} recipient(s)` });
  return NextResponse.json({ ok: true, sent, failed, campaignId: campaign.id });
}
