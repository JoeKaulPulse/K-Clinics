import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) return NextResponse.json({ ok: false, error: 'Not permitted' }, { status: 403 });

  const { newOAuthState, attachOAuthState } = await import('@/lib/oauth-state');
  const state = newOAuthState('truelayer');
  const { trueLayerAuthUrl } = await import('@/lib/truelayer');
  const url = trueLayerAuthUrl(state);
  if (!url) return NextResponse.json({ ok: false, error: 'Bank feed is not configured.' }, { status: 503 });
  return attachOAuthState(NextResponse.redirect(url), 'truelayer', state);
}
