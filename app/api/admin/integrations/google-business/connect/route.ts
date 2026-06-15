import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Begin the one-time Google Business Profile OAuth (business.manage). Requires
// settings.manage; the owner authorises their Google Business account once.
export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) return NextResponse.json({ ok: false, error: 'Not permitted' }, { status: 403 });

  const { businessAuthUrl, googleOAuthConfigured } = await import('@/lib/google-business');
  if (!(await googleOAuthConfigured())) {
    return NextResponse.redirect(new URL('/admin/reviews?gbiz=not_configured', req.url));
  }
  const { newOAuthState, attachOAuthState } = await import('@/lib/oauth-state');
  const state = newOAuthState('gbiz');
  const url = await businessAuthUrl(state);
  if (!url) return NextResponse.redirect(new URL('/admin/reviews?gbiz=not_configured', req.url));
  return attachOAuthState(NextResponse.redirect(url), 'gbiz', state);
}
