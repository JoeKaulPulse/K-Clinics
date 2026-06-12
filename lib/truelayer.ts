import 'server-only';
import { saveConnection, getConnection, validAccessToken, type Tokens } from '@/lib/oauth-connections';

// TrueLayer (Open Banking) OAuth 2.0 + live balance. Activates with credentials.
//   TRUELAYER_CLIENT_ID, TRUELAYER_CLIENT_SECRET, [TRUELAYER_REDIRECT_URI]

const PROVIDER = 'truelayer';
const SCOPE = 'info accounts balance offline_access';

export function trueLayerConfigured(): boolean {
  return Boolean(process.env.TRUELAYER_CLIENT_ID && process.env.TRUELAYER_CLIENT_SECRET);
}

function redirectUri(): string {
  return process.env.TRUELAYER_REDIRECT_URI || `${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/admin/integrations/truelayer/callback`;
}

export function trueLayerAuthUrl(state: string): string | null {
  if (!trueLayerConfigured()) return null;
  const p = new URLSearchParams({
    response_type: 'code', client_id: process.env.TRUELAYER_CLIENT_ID!, redirect_uri: redirectUri(),
    scope: SCOPE, providers: 'uk-ob-all uk-oauth-all', state,
  });
  return `https://auth.truelayer.com/?${p}`;
}

async function tokenRequest(body: Record<string, string>): Promise<Tokens | null> {
  const res = await fetch('https://auth.truelayer.com/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.TRUELAYER_CLIENT_ID!, client_secret: process.env.TRUELAYER_CLIENT_SECRET!, ...body }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const d = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!d.access_token) return null;
  return { access: d.access_token, refresh: d.refresh_token, expiresAt: d.expires_in ? Date.now() + d.expires_in * 1000 : null };
}

export async function exchangeTrueLayerCode(code: string): Promise<boolean> {
  if (!trueLayerConfigured()) return false;
  const tokens = await tokenRequest({ grant_type: 'authorization_code', redirect_uri: redirectUri(), code });
  if (!tokens) return false;
  await saveConnection(PROVIDER, tokens, null, 'Business bank');
  return true;
}

const refresh = (refreshToken: string) => tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });

/** Total available balance across connected accounts (pence). */
export async function getBankCashPence(): Promise<{ ok: boolean; availablePence: number; pendingPence: number; label: string | null }> {
  const conn = await getConnection(PROVIDER);
  if (!conn) return { ok: false, availablePence: 0, pendingPence: 0, label: null };
  const token = await validAccessToken(PROVIDER, refresh);
  if (!token) return { ok: false, availablePence: 0, pendingPence: 0, label: conn.label };
  try {
    const accRes = await fetch('https://api.truelayer.com/data/v1/accounts', { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) });
    if (!accRes.ok) return { ok: false, availablePence: 0, pendingPence: 0, label: conn.label };
    const accounts = ((await accRes.json()) as { results?: { account_id: string }[] }).results ?? [];
    let available = 0, current = 0;
    for (const a of accounts) {
      const balRes = await fetch(`https://api.truelayer.com/data/v1/accounts/${a.account_id}/balance`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) });
      if (!balRes.ok) continue;
      const bal = ((await balRes.json()) as { results?: { available?: number; current?: number }[] }).results?.[0];
      if (bal) { available += bal.available ?? 0; current += bal.current ?? 0; }
    }
    const pending = Math.max(0, current - available);
    return { ok: true, availablePence: Math.round(available * 100), pendingPence: Math.round(pending * 100), label: conn.label };
  } catch {
    return { ok: false, availablePence: 0, pendingPence: 0, label: conn.label };
  }
}
