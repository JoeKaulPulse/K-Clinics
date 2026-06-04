import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.redirect(new URL('/admin/reviews', req.url));
  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  const params = new URL(req.url).searchParams;
  const code = params.get('code');
  if (!sessionCan(session, 'settings.manage') || !code) {
    return NextResponse.redirect(new URL('/admin/reviews?gbiz=error', req.url));
  }
  const { consumeOAuthState } = await import('@/lib/oauth-state');
  if (!(await consumeOAuthState('gbiz', params.get('state')))) {
    return NextResponse.redirect(new URL('/admin/reviews?gbiz=error', req.url));
  }
  const { exchangeBusinessCode, syncGoogleReviews } = await import('@/lib/google-business');
  const ok = await exchangeBusinessCode(code);
  if (ok) {
    const { logAudit } = await import('@/lib/audit');
    await logAudit({ action: 'SETTINGS_UPDATED', actor: session!.email, actorRole: session!.role, summary: 'Connected Google Business Profile' });
    // First import in the background — don't block the redirect.
    syncGoogleReviews().catch(() => {});
  }
  return NextResponse.redirect(new URL(`/admin/reviews?gbiz=${ok ? 'connected' : 'error'}`, req.url));
}
