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
