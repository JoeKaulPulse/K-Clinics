import 'server-only';
import { googleAccessToken } from '@/lib/google-auth';
import { getSecret } from '@/lib/secrets';
import { site } from '@/lib/site';

// Google Search Console — Search Analytics query. Surfaces the organic search
// terms, impressions, clicks and ranking position that are otherwise invisible
// alongside paid spend. Needs a connected Google account with the
// webmasters.readonly scope (already requested) and the verified property.
// No-ops cleanly otherwise.

export type GscQuery = { query: string; clicks: number; impressions: number; ctr: number; position: number };
export type GscSummary = { configured: boolean; totals: { clicks: number; impressions: number; ctr: number }; topQueries: GscQuery[] };

export async function searchConsolePerformance(days = 28): Promise<GscSummary> {
  const empty: GscSummary = { configured: false, totals: { clicks: 0, impressions: 0, ctr: 0 }, topQueries: [] };
  try {
    const token = await googleAccessToken();
    if (!token) return empty;
    // GSC accepts a URL-prefix property ("https://kclinics.co.uk/") or a domain
    // property ("sc-domain:kclinics.co.uk"). Default to the URL-prefix form; allow
    // an override for domain properties.
    const siteUrl = (await getSecret('SEARCH_CONSOLE_SITE')) || site.url.replace(/\/?$/, '/');
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const startDate = fmt(new Date(Date.now() - days * 86400000));
    const endDate = fmt(new Date());

    const res = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ startDate, endDate, dimensions: ['query'], rowLimit: 20 }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return empty;
    const j = await res.json().catch(() => null);
    const rows = (j?.rows ?? []) as { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }[];
    const topQueries: GscQuery[] = rows.map((r) => ({
      query: r.keys?.[0] || '',
      clicks: Math.round(r.clicks ?? 0),
      impressions: Math.round(r.impressions ?? 0),
      ctr: r.ctr ?? 0,
      position: r.position ?? 0,
    }));
    const clicks = topQueries.reduce((a, r) => a + r.clicks, 0);
    const impressions = topQueries.reduce((a, r) => a + r.impressions, 0);
    return { configured: true, totals: { clicks, impressions, ctr: impressions > 0 ? clicks / impressions : 0 }, topQueries };
  } catch {
    return empty;
  }
}
