import 'server-only';
import { db } from '@/lib/db';
import { getConnection, validAccessToken } from '@/lib/oauth-connections';

// ─────────────────────────────────────────────────────────────────────────────
// Ad-spend sync. Pulls campaign-level spend from connected ad platforms and
// writes it onto the matching MarketingCampaign so ROI uses real spend instead
// of manual entry.
//
// Design notes:
// - Every fetcher is fully fault-tolerant: any error (missing scope, no account,
//   API change) resolves to [] so a sync can never break the app.
// - Spend is assumed to be in GBP (UK clinic, GBP ad accounts) and converted to
//   pence. Multi-currency FX is out of scope.
// - Campaigns are matched by normalised name against the MarketingCampaign's
//   name / slug / utmCampaign — so name your ad-platform campaign to match.
// ─────────────────────────────────────────────────────────────────────────────

export type ProviderSpend = { provider: string; campaignName: string; spendPence: number };

// Pinned platform API versions. Meta retires Graph versions ~2 years after
// release and Google Ads ~12 months, so these need a periodic bump — the
// /admin/api-health page probes them and goes red when a pinned version dies.
// (v19.0 sunset 21 May 2026 and v17 sunset 4 Jun 2025 — both previously broke
// spend sync silently because every fetcher swallows errors to [].)
export const META_GRAPH_VERSION = 'v23.0';
export const GOOGLE_ADS_API_VERSION = 'v22';

const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const toPence = (amount: number) => Math.max(0, Math.round(amount * 100));
const sinceUntil = (days: number) => {
  const until = new Date();
  const since = new Date(Date.now() - days * 86400000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { since: fmt(since), until: fmt(until) };
};

// ── Meta (Facebook/Instagram) — Graph API insights ───────────────────────────
async function metaSpend(days: number): Promise<ProviderSpend[]> {
  try {
    const conn = await getConnection('meta');
    if (!conn?.tokens.access) return [];
    const token = conn.tokens.access;
    const { since, until } = sinceUntil(days);
    // Ad accounts: from the stored accountRef, else discovered from the token.
    let accountIds = (conn.accountRef ? [conn.accountRef] : []).map((a) => a.replace(/^act_/, ''));
    if (accountIds.length === 0) {
      const r = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/me/adaccounts?fields=account_id&limit=50&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(10_000) });
      const j = await r.json().catch(() => ({}));
      accountIds = (j?.data ?? []).map((a: { account_id: string }) => a.account_id).filter(Boolean);
    }
    const out: ProviderSpend[] = [];
    for (const acct of accountIds) {
      const tr = encodeURIComponent(JSON.stringify({ since, until }));
      const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/act_${acct}/insights?level=campaign&fields=campaign_name,spend&time_range=${tr}&limit=200&access_token=${encodeURIComponent(token)}`;
      const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      const j = await r.json().catch(() => ({}));
      for (const row of j?.data ?? []) {
        const spend = Number(row.spend);
        if (row.campaign_name && spend > 0) out.push({ provider: 'meta', campaignName: row.campaign_name, spendPence: toPence(spend) });
      }
    }
    return out;
  } catch { return []; }
}

// ── Google Ads — REST searchStream (needs a developer token) ──────────────────

/** Refresh-token grant for the marketing Google connection. Google access
 *  tokens expire after ~1h, so the stored one is nearly always stale by the
 *  time a sync runs — exchange the refresh token for a fresh access token. */
export async function refreshGoogleTokens(refreshToken: string): Promise<{ access: string; refresh?: string; expiresAt: number | null } | null> {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const j = await res.json();
    if (!j.access_token) return null;
    // Google does not return a new refresh token on refresh — keep the old one.
    return { access: j.access_token, refresh: refreshToken, expiresAt: j.expires_in ? Date.now() + j.expires_in * 1000 : null };
  } catch { return null; }
}

async function googleSpend(days: number): Promise<ProviderSpend[]> {
  try {
    const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    const conn = await getConnection('google');
    const customerId = (conn?.accountRef || process.env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/-/g, '');
    if (!devToken || !conn?.tokens.access || !customerId) return []; // prerequisites not set up
    const access = await validAccessToken('google', refreshGoogleTokens);
    if (!access) return [];
    const query = `SELECT campaign.name, metrics.cost_micros FROM campaign WHERE segments.date DURING LAST_${days === 7 ? '7' : '30'}_DAYS`;
    const r = await fetch(`https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:searchStream`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access}`,
        'developer-token': devToken,
        ...(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ? { 'login-customer-id': process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/-/g, '') } : {}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(10_000),
    });
    const j = await r.json().catch(() => ([]));
    const rows = Array.isArray(j) ? j.flatMap((batch: { results?: unknown[] }) => batch.results ?? []) : (j?.results ?? []);
    const agg = new Map<string, number>();
    for (const row of rows as { campaign?: { name?: string }; metrics?: { costMicros?: string } }[]) {
      const name = row.campaign?.name;
      const micros = Number(row.metrics?.costMicros ?? 0);
      if (name && micros > 0) agg.set(name, (agg.get(name) ?? 0) + micros / 1e6);
    }
    return [...agg].map(([campaignName, amount]) => ({ provider: 'google', campaignName, spendPence: toPence(amount) }));
  } catch { return []; }
}

// ── TikTok — Business API integrated report ──────────────────────────────────
async function tiktokSpend(days: number): Promise<ProviderSpend[]> {
  try {
    const conn = await getConnection('tiktok');
    if (!conn?.tokens.access) return [];
    const token = conn.tokens.access;
    const base = 'https://business-api.tiktok.com/open_api/v1.3';
    let advertiserIds = conn.accountRef ? [conn.accountRef] : [];
    if (advertiserIds.length === 0) {
      const r = await fetch(`${base}/oauth2/advertiser/get/`, { headers: { 'Access-Token': token }, signal: AbortSignal.timeout(10_000) });
      const j = await r.json().catch(() => ({}));
      advertiserIds = (j?.data?.list ?? []).map((a: { advertiser_id: string }) => a.advertiser_id).filter(Boolean);
    }
    const { since, until } = sinceUntil(days);
    const out: ProviderSpend[] = [];
    for (const adv of advertiserIds) {
      const params = new URLSearchParams({
        advertiser_id: adv, report_type: 'BASIC', data_level: 'AUCTION_CAMPAIGN',
        dimensions: JSON.stringify(['campaign_id']), metrics: JSON.stringify(['campaign_name', 'spend']),
        start_date: since, end_date: until, page_size: '200',
      });
      const r = await fetch(`${base}/report/integrated/get/?${params}`, { headers: { 'Access-Token': token }, signal: AbortSignal.timeout(10_000) });
      const j = await r.json().catch(() => ({}));
      for (const row of j?.data?.list ?? []) {
        const name = row?.metrics?.campaign_name;
        const spend = Number(row?.metrics?.spend);
        if (name && spend > 0) out.push({ provider: 'tiktok', campaignName: name, spendPence: toPence(spend) });
      }
    }
    return out;
  } catch { return []; }
}

export type SyncResult = { ok: boolean; updated: number; totalPence: number; byProvider: Record<string, number>; matched: number; fetched: number };

/** Pull spend from every connected platform and write it to matching campaigns. */
export async function syncAdSpend(days = 30): Promise<SyncResult> {
  const rows = (await Promise.all([metaSpend(days), googleSpend(days), tiktokSpend(days)])).flat();
  const byProvider: Record<string, number> = {};
  for (const r of rows) byProvider[r.provider] = (byProvider[r.provider] ?? 0) + r.spendPence;

  // Aggregate platform spend by normalised campaign name.
  const spendByName = new Map<string, number>();
  for (const r of rows) spendByName.set(norm(r.campaignName), (spendByName.get(norm(r.campaignName)) ?? 0) + r.spendPence);

  const campaigns = await db.marketingCampaign.findMany({ select: { id: true, name: true, slug: true, utmCampaign: true } });
  let updated = 0, totalPence = 0, matched = 0;
  for (const c of campaigns) {
    const keys = [c.utmCampaign, c.slug, c.name].filter(Boolean).map((k) => norm(k as string));
    // Sum any platform campaign whose name matches one of this campaign's keys
    // (exact normalised match, or platform name contains a key / vice-versa).
    let spend = 0;
    for (const [name, pence] of spendByName) {
      if (keys.some((k) => k && (k === name || name.includes(k) || k.includes(name)))) spend += pence;
    }
    if (spend > 0) {
      matched++;
      await db.marketingCampaign.update({ where: { id: c.id }, data: { spendPence: spend, spendSyncedAt: new Date() } });
      updated++; totalPence += spend;
    }
  }
  return { ok: true, updated, totalPence, byProvider, matched, fetched: rows.length };
}
