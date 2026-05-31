import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.redirect(new URL('/admin/integrations', req.url));
  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  const code = new URL(req.url).searchParams.get('code');
  if (!sessionCan(session, 'settings.manage') || !code) {
    return NextResponse.redirect(new URL('/admin/integrations?bank=error', req.url));
  }
  const { exchangeTrueLayerCode } = await import('@/lib/truelayer');
  const ok = await exchangeTrueLayerCode(code);
  return NextResponse.redirect(new URL(`/admin/integrations?bank=${ok ? 'connected' : 'error'}`, req.url));
}
