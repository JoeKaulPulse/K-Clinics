import 'server-only';
import { db } from '@/lib/db';
import type { Attribution } from '@/lib/attribution';

// Server-side marketing-campaign helpers: CRUD shaping, attribution resolution
// and performance stats (attributed bookings, revenue, ROI).

export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'PAUSED' | 'ENDED';

export const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

/** Resolve a captured attribution to a campaign id — matched on slug or the
 *  campaign's utm_campaign token (live campaigns only). */
export async function resolveCampaignId(attrib: Attribution | null): Promise<string | null> {
  const token = attrib?.campaign?.trim();
  if (!token) return null;
  const c = await db.marketingCampaign.findFirst({
    where: {
      status: { in: ['ACTIVE', 'SCHEDULED', 'PAUSED', 'ENDED'] },
      OR: [{ slug: token }, { utmCampaign: token }],
    },
    select: { id: true },
  });
  return c?.id ?? null;
}

/** Read the first-touch attribution cookie plus the cookie-banner consent
 *  choice, and shape it for a Booking.create — resolving the matching
 *  campaign. The consent flags are always returned (default false — no cookie
 *  banner interaction yet) so a later deferred conversion send always has an
 *  explicit answer to check, even with no attribution cookie present. */
export async function bookingAttribution(): Promise<{
  attribSource?: string | null; attribMedium?: string | null; attribCampaign?: string | null;
  attribLanding?: string | null; gclid?: string | null; marketingCampaignId?: string | null;
  analyticsConsent: boolean; marketingConsent: boolean;
}> {
  const { cookies } = await import('next/headers');
  const { ANALYTICS_CONSENT_COOKIE, MARKETING_CONSENT_COOKIE } = await import('@/lib/attribution');
  const jar = await cookies();
  const analyticsConsent = jar.get(ANALYTICS_CONSENT_COOKIE)?.value === '1';
  const marketingConsent = jar.get(MARKETING_CONSENT_COOKIE)?.value === '1';
  try {
    const { ATTRIB_COOKIE, parseAttribution } = await import('@/lib/attribution');
    const attrib = parseAttribution(jar.get(ATTRIB_COOKIE)?.value);
    if (!attrib) return { analyticsConsent, marketingConsent };
    return {
      attribSource: attrib.source ?? null,
      attribMedium: attrib.medium ?? null,
      attribCampaign: attrib.campaign ?? null,
      attribLanding: attrib.landing ?? null,
      gclid: attrib.gclid ?? null,
      marketingCampaignId: await resolveCampaignId(attrib),
      analyticsConsent, marketingConsent,
    };
  } catch {
    return { analyticsConsent, marketingConsent };
  }
}

export type CampaignStats = { bookings: number; revenuePence: number; roi: number | null };

/** Attributed performance for a campaign: booked count + realised revenue
 *  (charged where present, else booked price), and ROI vs recorded spend. */
export async function campaignStats(campaignId: string, spendPence: number): Promise<CampaignStats> {
  const [count, agg, chargedAgg] = await Promise.all([
    db.booking.count({ where: { marketingCampaignId: campaignId } }),
    db.booking.aggregate({ where: { marketingCampaignId: campaignId }, _sum: { pricePence: true } }),
    db.booking.aggregate({ where: { marketingCampaignId: campaignId, chargedPence: { not: null } }, _sum: { chargedPence: true } }),
  ]);
  const revenuePence = (chargedAgg._sum.chargedPence ?? 0) || (agg._sum.pricePence ?? 0);
  const roi = spendPence > 0 ? Math.round(((revenuePence - spendPence) / spendPence) * 100) : null;
  return { bookings: count, revenuePence, roi };
}
