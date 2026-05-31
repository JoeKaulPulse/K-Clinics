import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';
import { SETTING_DEFAULTS, type SettingKey } from '@/lib/settings';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });

  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { key, value } = body as { key?: string; value?: boolean };
  if (!key || !(key in SETTING_DEFAULTS) || typeof value !== 'boolean') {
    return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
  }

  const { setSetting } = await import('@/lib/settings');
  await setSetting(key as SettingKey, value, session.email);
  return NextResponse.json({ ok: true });
}
