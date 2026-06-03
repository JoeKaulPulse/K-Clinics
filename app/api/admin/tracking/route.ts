import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
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
  const { SETTING_KEY } = await import('@/lib/tracking');
  await db.setting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value, updatedBy: session.email },
    update: { value, updatedBy: session.email },
  });

  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: 'Updated marketing tracking pixels' });
  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true });
}
