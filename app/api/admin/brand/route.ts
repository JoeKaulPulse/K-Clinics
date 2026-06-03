import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Save the brand kit (colours, fonts, logos, tagline, tone of voice).
// Requires settings.manage.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  if (!body || typeof body !== 'object') return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });

  const { db } = await import('@/lib/db');
  const { BRAND_SETTING_KEY } = await import('@/lib/brand');
  const value = JSON.stringify(body).slice(0, 60_000);
  await db.setting.upsert({
    where: { key: BRAND_SETTING_KEY },
    create: { key: BRAND_SETTING_KEY, value, updatedBy: session.email },
    update: { value, updatedBy: session.email },
  });

  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: 'Updated brand kit' });
  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true });
}
