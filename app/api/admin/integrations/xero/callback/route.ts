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
    return NextResponse.redirect(new URL('/admin/integrations?xero=error', req.url));
  }
  const { exchangeXeroCode } = await import('@/lib/xero');
  const ok = await exchangeXeroCode(code);
  return NextResponse.redirect(new URL(`/admin/integrations?xero=${ok ? 'connected' : 'error'}`, req.url));
}
