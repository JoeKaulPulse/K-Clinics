import 'server-only';
import { validAccessToken } from '@/lib/oauth-connections';
import { getSecret } from '@/lib/secrets';

// Shared Google OAuth access-token resolver (auto-refreshing). Used by every
// Google read/write API client — ad-spend, offline conversions, GA4 Data API,
// Search Console — so the refresh flow lives in one place.
export async function googleAccessToken(): Promise<string | null> {
  return validAccessToken('google', async (refreshToken) => {
    const id = await getSecret('GOOGLE_CLIENT_ID'), secret = await getSecret('GOOGLE_CLIENT_SECRET');
    if (!id || !secret) return null;
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const j = await res.json().catch(() => null);
    if (!j?.access_token) return null;
    // Google doesn't return a new refresh_token on refresh — keep the existing one.
    return { access: String(j.access_token), refresh: refreshToken, expiresAt: j.expires_in ? Date.now() + Number(j.expires_in) * 1000 : null };
  });
}
