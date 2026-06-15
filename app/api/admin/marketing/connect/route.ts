import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// GET ?provider= → begin OAuth (redirect to the platform). Requires settings.manage.
export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const { getProvider, isConfigured, authUrlFor } = await import('@/lib/marketing-connections');
  const providerId = new URL(req.url).searchParams.get('provider') || '';
  const p = getProvider(providerId);
  if (!p) return NextResponse.json({ ok: false, error: 'Unknown provider' }, { status: 400 });
  if (!(await isConfigured(p))) return NextResponse.redirect(new URL(`/admin/marketing/connections?error=${p.id}_not_configured`, req.url));

  const state = `${p.id}.${crypto.randomUUID()}`;
  const res = NextResponse.redirect(await authUrlFor(p, state));
  res.cookies.set('kc_oauth_state', state, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 600 });
  return res;
}

// POST { op:'disconnect', provider } → remove a connection.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  if (body.op !== 'disconnect' || !body.provider) return NextResponse.json({ ok: false }, { status: 400 });
  const { disconnect } = await import('@/lib/oauth-connections');
  await disconnect(String(body.provider));
  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Disconnected ${body.provider}` });
  const { revalidatePath } = await import('next/cache');
  revalidatePath('/admin/marketing/connections');
  return NextResponse.json({ ok: true });
}
