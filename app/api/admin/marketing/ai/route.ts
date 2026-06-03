import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const maxDuration = 60;

// AI marketing assistant (Claude Haiku). Requires campaigns.send.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = (await requirePermission('campaigns.send')) || (await requirePermission('settings.manage'));
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const { aiAvailable } = await import('@/lib/ai-marketing');
  if (!aiAvailable()) return NextResponse.json({ ok: false, error: 'AI is not configured (missing ANTHROPIC_API_KEY).' }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');

  if (body.op === 'generate') {
    if (!body.campaignId) return NextResponse.json({ ok: false, error: 'Missing campaign.' }, { status: 400 });
    const c = await db.marketingCampaign.findUnique({ where: { id: body.campaignId } });
    if (!c) return NextResponse.json({ ok: false, error: 'Campaign not found.' }, { status: 404 });
    const { generateCampaignPack } = await import('@/lib/ai-marketing');
    const pack = await generateCampaignPack({ name: c.name, goal: c.goal ?? 'bookings', audience: c.audience ?? '', brief: c.brief ?? '' });
    if (!pack) return NextResponse.json({ ok: false, error: 'The assistant couldn’t generate content — please try again.' }, { status: 502 });
    await db.marketingCampaign.update({ where: { id: c.id }, data: { aiDraft: pack as object } });
    const { logAudit } = await import('@/lib/audit');
    await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `AI generated content for “${c.name}”` });
    revalidatePath(`/admin/marketing/campaigns/${c.id}`);
    return NextResponse.json({ ok: true, pack });
  }

  if (body.op === 'optimise') {
    if (!body.campaignId) return NextResponse.json({ ok: false, error: 'Missing campaign.' }, { status: 400 });
    const c = await db.marketingCampaign.findUnique({ where: { id: body.campaignId } });
    if (!c) return NextResponse.json({ ok: false, error: 'Campaign not found.' }, { status: 404 });
    const { campaignStats } = await import('@/lib/marketing');
    const stats = await campaignStats(c.id, c.spendPence);
    // Top sources attributed to this campaign's bookings.
    const grouped = await db.booking.groupBy({ by: ['attribSource'], where: { marketingCampaignId: c.id }, _count: { _all: true }, _sum: { pricePence: true, chargedPence: true } });
    const topSources = grouped
      .map((g) => ({ label: g.attribSource || 'direct', bookings: g._count._all, revenuePence: (g._sum.chargedPence ?? 0) || (g._sum.pricePence ?? 0) }))
      .sort((a, b) => b.revenuePence - a.revenuePence).slice(0, 6);
    const daysRunning = c.startAt ? Math.max(0, Math.round((Date.now() - c.startAt.getTime()) / 86400000)) : 0;
    const { optimiseCampaign } = await import('@/lib/ai-marketing');
    const advice = await optimiseCampaign({
      name: c.name, goal: c.goal ?? 'bookings', audience: c.audience ?? '', daysRunning,
      bookings: stats.bookings, revenuePence: stats.revenuePence, spendPence: c.spendPence, budgetPence: c.budgetPence,
      roi: stats.roi, targetRevenuePence: c.targetRevenuePence, targetBookings: c.targetBookings, topSources,
    });
    if (!advice) return NextResponse.json({ ok: false, error: 'Couldn’t analyse right now — please try again.' }, { status: 502 });
    return NextResponse.json({ ok: true, advice });
  }

  if (body.op === 'rewrite') {
    const { rewriteVariants } = await import('@/lib/ai-marketing');
    const variants = await rewriteVariants(String(body.kind || 'line'), String(body.text || ''), Math.min(6, Number(body.n) || 4));
    if (!variants) return NextResponse.json({ ok: false, error: 'Could not generate variants.' }, { status: 502 });
    return NextResponse.json({ ok: true, variants });
  }

  return NextResponse.json({ ok: false, error: 'Unknown operation' }, { status: 400 });
}
