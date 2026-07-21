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
  configured: boolean;   // property id + a Google token are both present
  ok: boolean;           // the Data API call actually succeeded
  error: string | null;  // why it isn't showing data (API error / missing config)
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

// Run a batch of reports. Returns the reports plus an `error` string when the GA
// Data API rejects the call — so callers can show the real reason (wrong property
// id, no Viewer access, Data API not enabled) instead of silent zeros.
async function batchRunReports(propertyId: string, token: string, requests: object[]): Promise<{ reports: ({ rows?: ApiRow[] } | undefined)[]; error: string | null }> {
  try {
    const res = await fetch(`${API}/properties/${propertyId}:batchRunReports`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ requests }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      let reason = `HTTP ${res.status}`;
      try { const j = JSON.parse(body); if (j?.error) reason = `HTTP ${res.status} ${j.error.status || ''}: ${j.error.message || ''}`.replace(/\s+/g, ' ').trim(); }
      catch { if (body) reason = `HTTP ${res.status}: ${body.slice(0, 200)}`; }
      return { reports: [], error: reason };
    }
    const j = await res.json().catch(() => null);
    return { reports: (j?.reports ?? []) as ({ rows?: ApiRow[] } | undefined)[], error: null };
  } catch (e) {
    return { reports: [], error: `Request failed: ${(e as Error)?.message || 'network or timeout'}` };
  }
}

function emptyFull(days: number, partial?: Partial<Ga4FullReport>): Ga4FullReport {
  return {
    configured: false, ok: false, error: null, days,
    totals: { activeUsers: 0, newUsers: 0, sessions: 0, pageViews: 0, avgSessionDuration: 0, engagementRate: 0, bounceRate: 0, viewsPerSession: 0, conversions: 0 },
    trend: [], topPages: [], byChannel: [], byDevice: [], byCountry: [], landingPages: [],
    ...partial,
  };
}

export async function ga4FullReport(days = 28): Promise<Ga4FullReport> {
  try {
    const propertyId = await ga4PropertyId();
    if (!propertyId) return emptyFull(days, { error: 'GA4_PROPERTY_ID is not set — add the numeric property id (e.g. 123456789, GA4 → Admin → Property settings), not the G-XXXX measurement tag.' });
    let token = await googleAccessToken();
    if (!token) return emptyFull(days, { error: 'Google account is not connected (or its saved token could not be refreshed). Reconnect Google in Connections, granting the Analytics read permission.' });

    const range = [{ startDate: `${days}daysAgo`, endDate: 'today' }];
    // Two batches (max 5 reports each), run concurrently.
    const runAll = (tok: string) => Promise.all([
      batchRunReports(propertyId, tok, [
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
      batchRunReports(propertyId, tok, [
        // 0 — top countries
        { dateRanges: range, dimensions: [{ name: 'country' }], metrics: [{ name: 'sessions' }, { name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 10 },
        // 1 — landing pages (journey entry → conversion)
        { dateRanges: range, dimensions: [{ name: 'landingPage' }], metrics: [{ name: 'sessions' }, { name: 'conversions' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 12 },
      ]),
    ]);

    let [batchA, batchB] = await runAll(token);
    // A 401 means the stored access token is stale (some legacy rows keep a token
    // that perpetually looks "fresh" and never auto-refreshes). Force one refresh
    // via the refresh token and retry before giving up — so GA self-heals.
    if (/\b401\b|UNAUTHENTICATED/i.test(batchA.error || batchB.error || '')) {
      const refreshed = await googleAccessToken({ forceRefresh: true });
      if (refreshed && refreshed !== token) {
        token = refreshed;
        [batchA, batchB] = await runAll(token);
      }
    }

    // Surface the real reason rather than rendering all-zeros as if it were real
    // traffic (an API error and a genuinely-empty range look identical otherwise).
    const apiError = batchA.error || batchB.error;
    if (apiError) {
      console.error('[ga4] Data API error:', apiError);
      return emptyFull(days, { configured: true, ok: false, error: apiError });
    }
    const repA = batchA.reports, repB = batchB.reports;

    const ov = rowsOf(repA[0])[0]?.metricValues ?? [];
    const totals: Ga4Totals = {
      activeUsers: num(ov[0]?.value), newUsers: num(ov[1]?.value), sessions: num(ov[2]?.value), pageViews: num(ov[3]?.value),
      avgSessionDuration: num(ov[4]?.value), engagementRate: num(ov[5]?.value), bounceRate: num(ov[6]?.value),
      viewsPerSession: num(ov[7]?.value), conversions: num(ov[8]?.value),
    };
    const trend: Ga4Point[] = rowsOf(repA[1]).map((r) => {
      const d = r.dimensionValues?.[0]?.value || '';
      return { date: d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d, sessions: num(r.metricValues?.[0]?.value), users: num(r.metricValues?.[1]?.value) };
    });
    const topPages: Ga4Page[] = rowsOf(repA[2]).map((r) => {
      const views = num(r.metricValues?.[0]?.value), users = num(r.metricValues?.[1]?.value), engDur = num(r.metricValues?.[2]?.value);
      return { path: r.dimensionValues?.[0]?.value || '/', views, users, avgEngagement: users ? engDur / users : 0 };
    });
    const byChannel: Ga4Channel[] = rowsOf(repA[3]).map((r) => ({ source: r.dimensionValues?.[0]?.value || '(unknown)', sessions: num(r.metricValues?.[0]?.value), conversions: num(r.metricValues?.[1]?.value) }));
    const byDevice: Ga4Row[] = rowsOf(repA[4]).map((r) => ({ label: r.dimensionValues?.[0]?.value || '(unknown)', sessions: num(r.metricValues?.[0]?.value), users: num(r.metricValues?.[1]?.value) }));
    const byCountry: Ga4Row[] = rowsOf(repB[0]).map((r) => ({ label: r.dimensionValues?.[0]?.value || '(unknown)', sessions: num(r.metricValues?.[0]?.value), users: num(r.metricValues?.[1]?.value) }));
    const landingPages: Ga4Landing[] = rowsOf(repB[1]).map((r) => ({ path: r.dimensionValues?.[0]?.value || '/', sessions: num(r.metricValues?.[0]?.value), conversions: num(r.metricValues?.[1]?.value) }));

    return { configured: true, ok: true, error: null, days, totals, trend, topPages, byChannel, byDevice, byCountry, landingPages };
  } catch (e) {
    return emptyFull(days, { configured: true, ok: false, error: `Unexpected error: ${(e as Error)?.message || 'unknown'}` });
  }
}

// ── PRJ-724.5: GA4 Realtime (last 30 minutes) ───────────────────────────────
// The realtime endpoint is a different resource (:runRealtimeReport) but the same
// auth (Google token + numeric property id). Reports the live active-user count
// plus the top events and active pages, so the dashboard can show what is
// happening on the site right now.
export type Ga4Realtime = {
  configured: boolean;
  ok: boolean;
  error: string | null;
  activeUsers: number;
  byEvent: { name: string; count: number }[];
  byPage: { name: string; users: number }[];
};

async function runRealtimeReport(propertyId: string, token: string, body: object): Promise<{ rows: ApiRow[]; error: string | null }> {
  try {
    const res = await fetch(`${API}/properties/${propertyId}:runRealtimeReport`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      let reason = `HTTP ${res.status}`;
      try { const j = JSON.parse(t); if (j?.error) reason = `HTTP ${res.status}: ${j.error.message || ''}`.replace(/\s+/g, ' ').trim(); }
      catch { if (t) reason = `HTTP ${res.status}: ${t.slice(0, 200)}`; }
      return { rows: [], error: reason };
    }
    const j = await res.json().catch(() => null);
    return { rows: (j?.rows ?? []) as ApiRow[], error: null };
  } catch (e) {
    return { rows: [], error: `Request failed: ${(e as Error)?.message || 'network or timeout'}` };
  }
}

export async function ga4Realtime(): Promise<Ga4Realtime> {
  const base: Ga4Realtime = { configured: false, ok: false, error: null, activeUsers: 0, byEvent: [], byPage: [] };
  try {
    const propertyId = await ga4PropertyId();
    if (!propertyId) return { ...base, error: 'GA4_PROPERTY_ID is not set.' };
    let token = await googleAccessToken();
    if (!token) return { ...base, error: 'Google account is not connected.' };
    const run = (tok: string) => Promise.all([
      runRealtimeReport(propertyId, tok, { metrics: [{ name: 'activeUsers' }] }),
      runRealtimeReport(propertyId, tok, { dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }], orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }], limit: 8 }),
      runRealtimeReport(propertyId, tok, { dimensions: [{ name: 'unifiedScreenName' }], metrics: [{ name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: 8 }),
    ]);
    let [tot, ev, pg] = await run(token);
    if (/\b401\b|UNAUTHENTICATED/i.test(tot.error || ev.error || pg.error || '')) {
      const refreshed = await googleAccessToken({ forceRefresh: true });
      if (refreshed && refreshed !== token) { token = refreshed; [tot, ev, pg] = await run(token); }
    }
    const err = tot.error || ev.error || pg.error;
    if (err) return { ...base, configured: true, error: err };
    return {
      configured: true, ok: true, error: null,
      activeUsers: num(tot.rows[0]?.metricValues?.[0]?.value),
      byEvent: ev.rows.map((r) => ({ name: r.dimensionValues?.[0]?.value || '(unknown)', count: num(r.metricValues?.[0]?.value) })),
      byPage: pg.rows.map((r) => ({ name: r.dimensionValues?.[0]?.value || '(unknown)', users: num(r.metricValues?.[0]?.value) })),
    };
  } catch (e) {
    return { ...base, error: `Request failed: ${(e as Error)?.message || 'error'}` };
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
