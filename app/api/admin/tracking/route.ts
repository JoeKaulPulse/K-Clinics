import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Save the marketing/analytics pixel IDs (GA4, Google Ads, Meta Pixel).
// Requires settings.manage.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const clean = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 40) : '');
  const value = JSON.stringify({
    ga4Id: clean(body.ga4Id),
    googleAdsId: clean(body.googleAdsId),
    metaPixelId: clean(body.metaPixelId),
  });

  const { db } = await import('@/lib/db');
  const { SETTING_KEY, TRACKING_CONFIG_TAG } = await import('@/lib/tracking');
  await db.setting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value, updatedBy: session.email },
    update: { value, updatedBy: session.email },
  });

  // Server-side conversion secrets — only updated when a non-empty value is sent
  // (so saving the form doesn't wipe an existing secret you didn't re-enter).
  const ga4ApiSecret = typeof body.ga4ApiSecret === 'string' ? body.ga4ApiSecret.trim() : '';
  const metaCapiToken = typeof body.metaCapiToken === 'string' ? body.metaCapiToken.trim() : '';
  if (ga4ApiSecret || metaCapiToken) {
    const existing = await db.setting.findUnique({ where: { key: 'conversion_secrets' } });
    const cur = existing?.value ? (JSON.parse(existing.value) as Record<string, string>) : {};
    if (ga4ApiSecret) cur.ga4ApiSecret = ga4ApiSecret.slice(0, 200);
    if (metaCapiToken) cur.metaCapiToken = metaCapiToken.slice(0, 400);
    const cval = JSON.stringify(cur);
    await db.setting.upsert({ where: { key: 'conversion_secrets' }, create: { key: 'conversion_secrets', value: cval, updatedBy: session.email }, update: { value: cval, updatedBy: session.email } });
  }

  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: 'Updated marketing tracking pixels' });
  revalidateTag(TRACKING_CONFIG_TAG, {});
  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true });
}
