import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

const STATUSES = ['DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'ENDED'];
const CHANNELS = ['email', 'google_ads', 'meta', 'tiktok', 'seo', 'landing'];

// Create/manage umbrella marketing campaigns. Requires campaigns.send.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = (await requirePermission('campaigns.send')) || (await requirePermission('settings.manage'));
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');
  const { logAudit } = await import('@/lib/audit');
  const { slugify } = await import('@/lib/marketing');
  const ok = (data: object = {}) => NextResponse.json({ ok: true, ...data });
  const bad = (error = 'Bad request') => NextResponse.json({ ok: false, error }, { status: 400 });

  const num = (v: unknown) => (v == null || v === '' ? null : Math.max(0, Math.round(Number(v) * 100)));
  const date = (v: unknown) => (v ? new Date(String(v)) : null);

  switch (body.op) {
    case 'create': {
      const name = String(body.name ?? '').trim().slice(0, 120);
      if (!name) return bad('Name is required.');
      let slug = slugify(body.slug || name) || `campaign-${Date.now().toString(36)}`;
      if (await db.marketingCampaign.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
      const c = await db.marketingCampaign.create({ data: { name, slug, utmCampaign: slug, goal: body.goal || 'bookings', createdBy: session.email } });
      await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Created campaign “${name}”` });
      revalidatePath('/admin/marketing/campaigns');
      return ok({ id: c.id, slug });
    }
    case 'update': {
      if (!body.id) return bad();
      const existing = await db.marketingCampaign.findUnique({ where: { id: body.id } });
      if (!existing) return bad('Not found');
      const data: Record<string, unknown> = {};
      if (body.name !== undefined) data.name = String(body.name).trim().slice(0, 120);
      if (body.goal !== undefined) data.goal = String(body.goal).slice(0, 40);
      if (body.audience !== undefined) data.audience = String(body.audience).slice(0, 300) || null;
      if (body.description !== undefined) data.description = String(body.description).slice(0, 2000) || null;
      if (body.brief !== undefined) data.brief = String(body.brief).slice(0, 4000) || null;
      if (body.heroImage !== undefined) data.heroImage = String(body.heroImage).slice(0, 500) || null;
      if (body.utmCampaign !== undefined) data.utmCampaign = slugify(body.utmCampaign) || existing.slug;
      if (body.startAt !== undefined) data.startAt = date(body.startAt);
      if (body.endAt !== undefined) data.endAt = date(body.endAt);
      if (body.budget !== undefined) data.budgetPence = num(body.budget);
      if (body.spend !== undefined) data.spendPence = num(body.spend) ?? 0;
      if (body.targetRevenue !== undefined) data.targetRevenuePence = num(body.targetRevenue);
      if (body.targetBookings !== undefined) data.targetBookings = body.targetBookings === '' ? null : Math.max(0, Math.round(Number(body.targetBookings)));
      if (Array.isArray(body.channels)) data.channels = body.channels.filter((c: string) => CHANNELS.includes(c));
      if (body.status !== undefined && STATUSES.includes(body.status)) data.status = body.status;
      await db.marketingCampaign.update({ where: { id: body.id }, data });
      revalidatePath('/admin/marketing/campaigns');
      revalidatePath(`/admin/marketing/campaigns/${body.id}`);
      return ok();
    }
    case 'remove': {
      if (!body.id) return bad();
      await db.marketingCampaign.delete({ where: { id: body.id } }).catch(() => {});
      await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: 'Deleted a campaign' });
      revalidatePath('/admin/marketing/campaigns');
      return ok();
    }
    default:
      return bad('Unknown operation');
  }
}
