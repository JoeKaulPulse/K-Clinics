import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Google SSO callback. Validate the one-time CSRF state, verify the id-token,
// enforce the allowed Workspace domain, then either sign the matching staff
// member in (issuing the normal admin session) or surface a "pending approval"
// / "deactivated" message. Any failure routes back to the login page with a
// reason code — never an error page or a leaked detail.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const back = (q: string) => NextResponse.redirect(new URL(`/admin/login?sso=${q}`, req.url));

  // Validate the cookie-bound, single-use state first (timing-safe).
  const { consumeOAuthState } = await import('@/lib/oauth-state');
  if (!code || !state || !(await consumeOAuthState('gsso', state))) return back('error');

  const { googleSsoEnabled, exchangeSsoCode, verifyGoogleIdToken, emailDomainAllowed } = await import('@/lib/google-sso');
  if (!(await googleSsoEnabled())) return back('unavailable');

  const idToken = await exchangeSsoCode(code);
  if (!idToken) return back('error');
  const identity = await verifyGoogleIdToken(idToken);
  if (!identity || !identity.emailVerified) return back('error');
  if (!emailDomainAllowed(identity.email)) return back('domain');

  // Same-origin return path carried after the nonce (validated in the start route).
  const from = decodeURIComponent(state.split('|')[1] || '');
  const dest = from.startsWith('/') && !from.startsWith('//') ? from : '/admin';

  const { resolveOrProvisionSsoUser } = await import('@/lib/google-sso-provision');
  const result = await resolveOrProvisionSsoUser(identity);
  if (result.outcome === 'pending') return back('pending');
  if (result.outcome === 'deactivated') return back('deactivated');
  if (result.outcome !== 'ok') return back('error');

  const user = result.user;
  const { createSession } = await import('@/lib/auth');
  await createSession({
    sub: user.id,
    email: user.email,
    name: user.name || undefined,
    role: user.role,
    grant: user.permGrant ?? [],
    revoke: user.permRevoke ?? [],
    epoch: user.sessionEpoch ?? 0,
  });

  // Audit + brute-force-counter parity with the password path (best-effort).
  try {
    const { recordLogin } = await import('@/lib/security/guard');
    await recordLogin('admin', user.email, true, req, { sso: 'google' });
  } catch {
    /* non-fatal */
  }

  const res = NextResponse.redirect(new URL(dest, req.url));
  res.cookies.set('kc_lang', user.locale === 'uk' ? 'uk' : 'en', { httpOnly: false, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 });
  return res;
}
