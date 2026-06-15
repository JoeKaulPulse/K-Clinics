import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Begin "Sign in with Google" for staff. No session required — this is a login
// entry point. CSRF-protected with a cookie-bound state nonce (mirrors the
// Xero/TrueLayer/gcal flows). A same-origin `from` path rides after the nonce so
// the callback can return the user to where they were headed without any
// open-redirect risk.
export async function GET(req: Request) {
  const loginErr = (q: string) => NextResponse.redirect(new URL(`/admin/login?sso=${q}`, req.url));

  const { googleSsoEnabled, googleSsoAuthUrl } = await import('@/lib/google-sso');
  if (!(await googleSsoEnabled())) return loginErr('unavailable');

  const from = new URL(req.url).searchParams.get('from') || '';
  const safeFrom = from.startsWith('/') && !from.startsWith('//') ? from : '';

  const { newOAuthState, attachOAuthState } = await import('@/lib/oauth-state');
  const state = `${newOAuthState('gsso')}|${encodeURIComponent(safeFrom)}`;
  const url = await googleSsoAuthUrl(state);
  if (!url) return loginErr('error');
  return attachOAuthState(NextResponse.redirect(url), 'gsso', state);
}
