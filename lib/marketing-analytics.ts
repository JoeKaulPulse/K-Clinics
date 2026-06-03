import 'server-only';
import { db } from '@/lib/db';

// First-party marketing analytics + forecasting — powered by our own booking
// attribution (reliable, no external API needed). Connected ad platforms layer
// spend on top once authorised.

const WEEK = 7 * 24 * 60 * 60 * 1000;
// Net realised value: charged amount where taken, else list price minus any
// loyalty-points redemption (counting gross would overstate attributed revenue).
const rev = (b: { chargedPence: number | null; pricePence: number; pointsRedeemedPence?: number | null }) =>
  b.chargedPence ?? Math.max(0, (b.pricePence ?? 0) - (b.pointsRedeemedPence ?? 0));
const isoWeek = (d: Date) => { const t = new Date(d); t.setHours(0, 0, 0, 0); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return t.getTime(); };

export type Bucket = { key: string; label: string; bookings: number; revenuePence: number };
export type MarketingPerformance = {
  totals: { revenuePence: number; bookings: number; attributedRevenuePence: number; attributedBookings: number; attributedPct: number };
  bySource: Bucket[];
  byCampaign: (Bucket & { id: string | null })[];
  weekly: { weekStart: string; revenuePence: number }[];
  forecast: { next30Pence: number; weeklyRunRatePence: number; trend: 'up' | 'down' | 'flat' };
};

export async function marketingPerformance(days = 90): Promise<MarketingPerformance> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [bookings, campaigns] = await Promise.all([
    db.booking.findMany({
      where: { createdAt: { gte: since }, status: { notIn: ['CANCELLED'] } },
      select: { pricePence: true, chargedPence: true, pointsRedeemedPence: true, createdAt: true, attribSource: true, marketingCampaignId: true },
    }),
    db.marketingCampaign.findMany({ select: { id: true, name: true } }),
  ]);
  const campName = new Map(campaigns.map((c) => [c.id, c.name]));

  let revenuePence = 0, attributedRevenuePence = 0, attributedBookings = 0;
  const sources = new Map<string, Bucket>();
  const camps = new Map<string, Bucket & { id: string | null }>();
  const weeks = new Map<number, number>();

  for (const b of bookings) {
    const r = rev(b);
    revenuePence += r;
    const wk = isoWeek(b.createdAt);
    weeks.set(wk, (weeks.get(wk) ?? 0) + r);

    const src = (b.attribSource || '').trim() || 'direct';
    const s = sources.get(src) ?? { key: src, label: src, bookings: 0, revenuePence: 0 };
    s.bookings++; s.revenuePence += r; sources.set(src, s);

    if (b.attribSource || b.marketingCampaignId) { attributedRevenuePence += r; attributedBookings++; }
    if (b.marketingCampaignId) {
      const c = camps.get(b.marketingCampaignId) ?? { id: b.marketingCampaignId, key: b.marketingCampaignId, label: campName.get(b.marketingCampaignId) ?? 'Campaign', bookings: 0, revenuePence: 0 };
      c.bookings++; c.revenuePence += r; camps.set(b.marketingCampaignId, c);
    }
  }

  // Weekly series across the window (fill gaps with 0).
  const startWeek = isoWeek(since);
  const weekly: { weekStart: string; revenuePence: number }[] = [];
  for (let w = startWeek; w <= isoWeek(new Date()); w += WEEK) weekly.push({ weekStart: new Date(w).toISOString().slice(0, 10), revenuePence: weeks.get(w) ?? 0 });

  return {
    totals: {
      revenuePence, bookings: bookings.length, attributedRevenuePence, attributedBookings,
      attributedPct: revenuePence > 0 ? Math.round((attributedRevenuePence / revenuePence) * 100) : 0,
    },
    bySource: [...sources.values()].sort((a, b) => b.revenuePence - a.revenuePence),
    byCampaign: [...camps.values()].sort((a, b) => b.revenuePence - a.revenuePence),
    weekly,
    forecast: forecast(weekly.map((w) => w.revenuePence)),
  };
}

/** Linear-regression projection of the next 30 days from recent weekly revenue. */
function forecast(series: number[]): { next30Pence: number; weeklyRunRatePence: number; trend: 'up' | 'down' | 'flat' } {
  const pts = series.slice(-8); // last 8 weeks
  const n = pts.length;
  if (n < 2) { const v = pts[0] ?? 0; return { next30Pence: Math.round(v * 4.33), weeklyRunRatePence: v, trend: 'flat' }; }
  const sx = (n - 1) * n / 2;
  const sy = pts.reduce((a, b) => a + b, 0);
  const sxx = pts.reduce((a, _, i) => a + i * i, 0);
  const sxy = pts.reduce((a, y, i) => a + i * y, 0);
  const denom = n * sxx - sx * sx;
  const slope = denom !== 0 ? (n * sxy - sx * sy) / denom : 0;
  const intercept = (sy - slope * sx) / n;
  const nextWeeks = [n, n + 1, n + 2, n + 3].map((i) => Math.max(0, intercept + slope * i));
  const next30Pence = Math.round((nextWeeks.reduce((a, b) => a + b, 0) / 4) * 4.33);
  const weeklyRunRatePence = Math.round(nextWeeks.reduce((a, b) => a + b, 0) / 4);
  const trend = slope > sy / n * 0.03 ? 'up' : slope < -(sy / n) * 0.03 ? 'down' : 'flat';
  return { next30Pence, weeklyRunRatePence, trend };
}
