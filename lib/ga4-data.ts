import 'server-only';
import { googleAccessToken } from '@/lib/google-auth';
import { getSecret } from '@/lib/secrets';

// GA4 Data API (runReport) — pulls live traffic + conversions by channel into the
// admin, complementing first-party booking attribution with what GA4 actually
// sees. Needs the numeric GA4 PROPERTY id (distinct from the G-XXXX measurement
// id) in GA4_PROPERTY_ID, plus a connected Google account with the
// analytics.readonly scope (already requested). No-ops cleanly otherwise.

const API = 'https://analyticsdata.googleapis.com/v1beta';

export type Ga4Channel = { source: string; sessions: number; conversions: number };
export type Ga4Summary = { configured: boolean; sessions: number; conversions: number; byChannel: Ga4Channel[] };

export async function ga4PropertyId(): Promise<string | null> {
  const id = ((await getSecret('GA4_PROPERTY_ID')) || '').replace(/\D/g, '');
  return id || null;
}

// ── Full report (overview, trend, pages, channels, devices, countries) ────────
// One batched pull (two batchRunReports calls, run concurrently) that feeds the
// dedicated GA4 analytics page and the marketing dashboard snapshot. Everything
// no-ops to `configured: false` when Google isn't connected or the property id
// is unset, so callers can render a connect-prompt without special-casing.

export type Ga4Totals = {
  activeUsers: number;
  newUsers: number;
  sessions: number;
  pageViews: number;
  avgSessionDuration: number; // seconds
  engagementRate: number;     // 0..1
  bounceRate: number;         // 0..1
  viewsPerSession: number;
  conversions: number;
};
export type Ga4Point = { date: string; sessions: number; users: number };
export type Ga4Page = { path: string; views: number; users: number; avgEngagement: number };
export type Ga4Row = { label: string; sessions: number; users: number };
export type Ga4Landing = { path: string; sessions: number; conversions: number };
export type Ga4FullReport = {
  configured: boolean;
  days: number;
  totals: Ga4Totals;
  trend: Ga4Point[];
  topPages: Ga4Page[];
  byChannel: Ga4Channel[];
  byDevice: Ga4Row[];
  byCountry: Ga4Row[];
  landingPages: Ga4Landing[];
};

const num = (v?: string) => Number(v ?? 0) || 0;
type ApiRow = { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] };
const rowsOf = (report: { rows?: ApiRow[] } | undefined): ApiRow[] => report?.rows ?? [];

async function batchRunReports(propertyId: string, token: string, requests: object[]): Promise<({ rows?: ApiRow[] } | undefined)[]> {
  const res = await fetch(`${API}/properties/${propertyId}:batchRunReports`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ requests }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return [];
  const j = await res.json().catch(() => null);
  return (j?.reports ?? []) as ({ rows?: ApiRow[] } | undefined)[];
}

function emptyFull(days: number): Ga4FullReport {
  return {
    configured: false, days,
    totals: { activeUsers: 0, newUsers: 0, sessions: 0, pageViews: 0, avgSessionDuration: 0, engagementRate: 0, bounceRate: 0, viewsPerSession: 0, conversions: 0 },
    trend: [], topPages: [], byChannel: [], byDevice: [], byCountry: [], landingPages: [],
  };
}

export async function ga4FullReport(days = 28): Promise<Ga4FullReport> {
  try {
    const propertyId = await ga4PropertyId();
    if (!propertyId) return emptyFull(days);
    const token = await googleAccessToken();
    if (!token) return emptyFull(days);

    const range = [{ startDate: `${days}daysAgo`, endDate: 'today' }];
    // Two batches (max 5 reports each), run concurrently.
    const [batchA, batchB] = await Promise.all([
      batchRunReports(propertyId, token, [
        // 0 — overview totals (no dimensions)
        { dateRanges: range, metrics: [
          { name: 'activeUsers' }, { name: 'newUsers' }, { name: 'sessions' }, { name: 'screenPageViews' },
          { name: 'averageSessionDuration' }, { name: 'engagementRate' }, { name: 'bounceRate' },
          { name: 'screenPageViewsPerSession' }, { name: 'conversions' },
        ] },
        // 1 — daily trend
        { dateRanges: range, dimensions: [{ name: 'date' }], metrics: [{ name: 'sessions' }, { name: 'activeUsers' }], orderBys: [{ dimension: { dimensionName: 'date' } }], limit: 400 },
        // 2 — top pages
        { dateRanges: range, dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }, { name: 'userEngagementDuration' }], orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 15 },
        // 3 — channels
        { dateRanges: range, dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: [{ name: 'sessions' }, { name: 'conversions' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 12 },
        // 4 — devices
        { dateRanges: range, dimensions: [{ name: 'deviceCategory' }], metrics: [{ name: 'sessions' }, { name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 6 },
      ]),
      batchRunReports(propertyId, token, [
        // 0 — top countries
        { dateRanges: range, dimensions: [{ name: 'country' }], metrics: [{ name: 'sessions' }, { name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 10 },
        // 1 — landing pages (journey entry → conversion)
        { dateRanges: range, dimensions: [{ name: 'landingPage' }], metrics: [{ name: 'sessions' }, { name: 'conversions' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 12 },
      ]),
    ]);

    const ov = rowsOf(batchA[0])[0]?.metricValues ?? [];
    const totals: Ga4Totals = {
      activeUsers: num(ov[0]?.value), newUsers: num(ov[1]?.value), sessions: num(ov[2]?.value), pageViews: num(ov[3]?.value),
      avgSessionDuration: num(ov[4]?.value), engagementRate: num(ov[5]?.value), bounceRate: num(ov[6]?.value),
      viewsPerSession: num(ov[7]?.value), conversions: num(ov[8]?.value),
    };
    const trend: Ga4Point[] = rowsOf(batchA[1]).map((r) => {
      const d = r.dimensionValues?.[0]?.value || '';
      return { date: d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d, sessions: num(r.metricValues?.[0]?.value), users: num(r.metricValues?.[1]?.value) };
    });
    const topPages: Ga4Page[] = rowsOf(batchA[2]).map((r) => {
      const views = num(r.metricValues?.[0]?.value), users = num(r.metricValues?.[1]?.value), engDur = num(r.metricValues?.[2]?.value);
      return { path: r.dimensionValues?.[0]?.value || '/', views, users, avgEngagement: users ? engDur / users : 0 };
    });
    const byChannel: Ga4Channel[] = rowsOf(batchA[3]).map((r) => ({ source: r.dimensionValues?.[0]?.value || '(unknown)', sessions: num(r.metricValues?.[0]?.value), conversions: num(r.metricValues?.[1]?.value) }));
    const byDevice: Ga4Row[] = rowsOf(batchA[4]).map((r) => ({ label: r.dimensionValues?.[0]?.value || '(unknown)', sessions: num(r.metricValues?.[0]?.value), users: num(r.metricValues?.[1]?.value) }));
    const byCountry: Ga4Row[] = rowsOf(batchB[0]).map((r) => ({ label: r.dimensionValues?.[0]?.value || '(unknown)', sessions: num(r.metricValues?.[0]?.value), users: num(r.metricValues?.[1]?.value) }));
    const landingPages: Ga4Landing[] = rowsOf(batchB[1]).map((r) => ({ path: r.dimensionValues?.[0]?.value || '/', sessions: num(r.metricValues?.[0]?.value), conversions: num(r.metricValues?.[1]?.value) }));

    // If the property is set but returned nothing at all, still mark configured so
    // the page shows "no data in range" rather than the connect prompt.
    return { configured: true, days, totals, trend, topPages, byChannel, byDevice, byCountry, landingPages };
  } catch {
    return emptyFull(days);
  }
}

export async function ga4Performance(days = 90): Promise<Ga4Summary> {
  const empty: Ga4Summary = { configured: false, sessions: 0, conversions: 0, byChannel: [] };
  try {
    const propertyId = await ga4PropertyId();
    if (!propertyId) return empty;
    const token = await googleAccessToken();
    if (!token) return empty;

    const res = await fetch(`${API}/properties/${propertyId}:runReport`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }, { name: 'conversions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 12,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return empty;
    const j = await res.json().catch(() => null);
    const rows = (j?.rows ?? []) as { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }[];
    const byChannel: Ga4Channel[] = rows.map((r) => ({
      source: r.dimensionValues?.[0]?.value || '(unknown)',
      sessions: Number(r.metricValues?.[0]?.value ?? 0),
      conversions: Number(r.metricValues?.[1]?.value ?? 0),
    }));
    const sessions = byChannel.reduce((s, r) => s + r.sessions, 0);
    const conversions = byChannel.reduce((s, r) => s + r.conversions, 0);
    return { configured: true, sessions, conversions, byChannel };
  } catch {
    return empty;
  }
}
