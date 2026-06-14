import 'server-only';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getSecret } from '@/lib/secrets';
import { site } from '@/lib/site';

// ── Google Workspace SSO ("Sign in with Google") for staff ──────────────────
// OpenID Connect on top of the SAME Google OAuth client the calendar/ads
// integrations use (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET). Staff click "Sign
// in with Google" on /admin/login; we verify the returned id-token, enforce the
// allowed Workspace domain(s), then either sign the matching staff member in or
// provision a disabled "pending approval" account (see lib/google-sso-provision).
//
// Off by default — the button only appears, and the routes only act, when
// GOOGLE_SSO_ENABLED=true AND the OAuth client is configured. Password + passkey
// sign-in always stay available as a fallback, so a Google outage can't lock
// anyone out.

const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export type GoogleIdentity = { sub: string; email: string; emailVerified: boolean; name?: string; hd?: string };

/** SSO is *configured* once the shared Google OAuth client credentials exist. */
export async function googleSsoConfigured(): Promise<boolean> {
  return Boolean((await getSecret('GOOGLE_CLIENT_ID')) && (await getSecret('GOOGLE_CLIENT_SECRET')));
}

/** Master switch — gates both the login button and the OAuth routes. */
export async function googleSsoEnabled(): Promise<boolean> {
  return process.env.GOOGLE_SSO_ENABLED === 'true' && (await googleSsoConfigured());
}

/** Workspace domains permitted to sign in; any other domain is rejected even
 *  with a valid Google account. Override with GOOGLE_SSO_ALLOWED_DOMAINS
 *  (comma-separated). The default matches the clinic's two Workspace domains. */
export function allowedDomains(): string[] {
  const raw = process.env.GOOGLE_SSO_ALLOWED_DOMAINS;
  return (raw && raw.trim() ? raw.split(',') : ['kclinics.co.uk', 'kaulindustries.com'])
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export function emailDomainAllowed(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  return allowedDomains().includes(domain);
}

/** Redirect URI registered with Google for the SSO flow. Derived from the
 *  canonical site URL so it always matches; override with GOOGLE_SSO_REDIRECT_URI. */
export function ssoRedirectUri(): string {
  return process.env.GOOGLE_SSO_REDIRECT_URI || `${site.url}/api/admin/oauth/google/callback`;
}

/** Build the Google consent URL. `state` is the cookie-bound CSRF nonce. */
export async function googleSsoAuthUrl(state: string): Promise<string | null> {
  const clientId = await getSecret('GOOGLE_CLIENT_ID');
  if (!clientId) return null;
  const domains = allowedDomains();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: ssoRedirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
    // `hd` only hints the account chooser; the real gate is the verified-claim
    // domain check below. Pin it only when exactly one domain is allowed.
    ...(domains.length === 1 ? { hd: domains[0] } : {}),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

/** Exchange the auth code for tokens; return the signed id-token (a JWT). */
export async function exchangeSsoCode(code: string): Promise<string | null> {
  const clientId = await getSecret('GOOGLE_CLIENT_ID');
  const clientSecret = await getSecret('GOOGLE_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    signal: AbortSignal.timeout(10_000),
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: ssoRedirectUri(),
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as { id_token?: string } | null;
  return data?.id_token ?? null;
}

/** Verify the id-token's signature (Google JWKS) + issuer + audience, returning
 *  the identity, or null if anything fails. */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity | null> {
  const clientId = await getSecret('GOOGLE_CLIENT_ID');
  if (!clientId) return null;
  try {
    const { payload } = await jwtVerify(idToken, JWKS, { issuer: GOOGLE_ISSUERS, audience: clientId });
    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
    if (!payload.sub || !email) return null;
    return {
      sub: String(payload.sub),
      email,
      emailVerified: payload.email_verified === true || payload.email_verified === 'true',
      name: typeof payload.name === 'string' ? payload.name : undefined,
      hd: typeof payload.hd === 'string' ? payload.hd : undefined,
    };
  } catch {
    return null;
  }
}
