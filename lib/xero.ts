import 'server-only';
import { saveConnection, getConnection, validAccessToken, type Tokens } from '@/lib/oauth-connections';

// Xero OAuth 2.0 + cash-position read. Activates when credentials are present.
//   XERO_CLIENT_ID, XERO_CLIENT_SECRET, [XERO_REDIRECT_URI]

const PROVIDER = 'xero';
const SCOPE = 'openid profile email accounting.reports.read accounting.settings.read offline_access';

export function xeroConfigured(): boolean {
  return Boolean(process.env.XERO_CLIENT_ID && process.env.XERO_CLIENT_SECRET);
}

function redirectUri(): string {
  return process.env.XERO_REDIRECT_URI || `${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/admin/integrations/xero/callback`;
}

export function xeroAuthUrl(state: string): string | null {
  if (!xeroConfigured()) return null;
  const p = new URLSearchParams({ response_type: 'code', client_id: process.env.XERO_CLIENT_ID!, redirect_uri: redirectUri(), scope: SCOPE, state });
  return `https://login.xero.com/identity/connect/authorize?${p}`;
}

async function tokenRequest(body: Record<string, string>): Promise<Tokens | null> {
  const basic = Buffer.from(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  if (!res.ok) return null;
  const d = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!d.access_token) return null;
  return { access: d.access_token, refresh: d.refresh_token, expiresAt: d.expires_in ? Date.now() + d.expires_in * 1000 : null };
}

export async function exchangeXeroCode(code: string): Promise<boolean> {
  if (!xeroConfigured()) return false;
  const tokens = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri() });
  if (!tokens) return false;
  // Resolve the tenant (org) this token can access.
  let tenantId: string | null = null, tenantName: string | null = null;
  try {
    const res = await fetch('https://api.xero.com/connections', { headers: { Authorization: `Bearer ${tokens.access}`, 'Content-Type': 'application/json' } });
    if (res.ok) {
      const conns = (await res.json()) as { tenantId: string; tenantName: string }[];
      tenantId = conns[0]?.tenantId ?? null;
      tenantName = conns[0]?.tenantName ?? null;
    }
  } catch { /* ignore */ }
  await saveConnection(PROVIDER, tokens, tenantId, tenantName);
  return true;
}

const refresh = (refreshToken: string) => tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });

/** Total cash across bank accounts (pence), via the Bank Summary report. */
export async function getXeroCashPence(): Promise<{ ok: boolean; pence: number; label: string | null }> {
  const conn = await getConnection(PROVIDER);
  if (!conn) return { ok: false, pence: 0, label: null };
  const token = await validAccessToken(PROVIDER, refresh);
  if (!token || !conn.accountRef) return { ok: false, pence: 0, label: conn.label };
  try {
    const res = await fetch('https://api.xero.com/api.xro/2.0/Reports/BankSummary', {
      headers: { Authorization: `Bearer ${token}`, 'Xero-tenant-id': conn.accountRef, Accept: 'application/json' },
    });
    if (!res.ok) return { ok: false, pence: 0, label: conn.label };
    const data = (await res.json()) as { Reports?: { Rows?: { RowType?: string; Rows?: { Cells?: { Value?: string }[] }[] }[] }[] };
    // Sum the closing-balance cell (last cell) of each summary row.
    let total = 0;
    const sections = data.Reports?.[0]?.Rows ?? [];
    for (const sec of sections) {
      for (const row of sec.Rows ?? []) {
        const cells = row.Cells ?? [];
        const last = cells[cells.length - 1]?.Value;
        const n = last ? parseFloat(last) : NaN;
        if (Number.isFinite(n)) total += n;
      }
    }
    return { ok: true, pence: Math.round(total * 100), label: conn.label };
  } catch {
    return { ok: false, pence: 0, label: conn.label };
  }
}
