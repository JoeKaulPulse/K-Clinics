import 'server-only';
import { cache } from 'react';
import { db } from '@/lib/db';
import { crmEnabled } from '@/lib/crm';

// ── Service catalogue + offer pricing ────────────────────────────────────────
// The CRM-managed catalogue (Service → ServiceVariant) with special offers.
// Marketing copy stays in lib/treatments.ts; price/cost/duration/offers here.

export type Course = { sessions: number; totalPence: number };

export type VariantView = {
  id: string;
  serviceId: string;
  name: string;
  durationMin: number;
  pricePence: number;
  costPence: number | null;
  courses: Course[];
};

export type ServiceView = {
  id: string;
  slug: string;
  treatmentSlug: string;
  name: string;
  category: string;
  active: boolean;
  variants: VariantView[];
};

export type OfferView = {
  id: string;
  name: string;
  scope: 'ALL' | 'SERVICE' | 'VARIANT';
  serviceId: string | null;
  variantId: string | null;
  percentOff: number | null;
  amountOffPence: number | null;
  startAt: Date | null;
  endAt: Date | null;
  promoted: boolean;
};

function asCourses(json: unknown): Course[] {
  if (!Array.isArray(json)) return [];
  return json
    .filter((c): c is Course => !!c && typeof (c as Course).sessions === 'number' && typeof (c as Course).totalPence === 'number')
    .sort((a, b) => a.sessions - b.sessions);
}

const toVariant = (v: { id: string; serviceId: string; name: string; durationMin: number; pricePence: number; costPence: number | null; courses: unknown }): VariantView =>
  ({ id: v.id, serviceId: v.serviceId, name: v.name, durationMin: v.durationMin, pricePence: v.pricePence, costPence: v.costPence, courses: asCourses(v.courses) });

/** Active services with their active variants, ordered for display. */
export async function listServices(includeInactive = false): Promise<ServiceView[]> {
  const rows = await db.service.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: { order: 'asc' },
    include: { variants: { where: includeInactive ? {} : { active: true }, orderBy: { order: 'asc' } } },
  });
  return rows.map((s) => ({
    id: s.id, slug: s.slug, treatmentSlug: s.treatmentSlug, name: s.name, category: s.category, active: s.active,
    variants: s.variants.map(toVariant),
  }));
}

export async function getServiceByTreatment(treatmentSlug: string): Promise<ServiceView | null> {
  const s = await db.service.findFirst({
    where: { treatmentSlug, active: true },
    include: { variants: { where: { active: true }, orderBy: { order: 'asc' } } },
  });
  if (!s) return null;
  return { id: s.id, slug: s.slug, treatmentSlug: s.treatmentSlug, name: s.name, category: s.category, active: s.active, variants: s.variants.map(toVariant) };
}

export async function getVariant(variantId: string) {
  const v = await db.serviceVariant.findUnique({ where: { id: variantId }, include: { service: true } });
  if (!v || !v.active) return null;
  return { variant: toVariant(v), service: v.service };
}

const inWindow = (o: { startAt: Date | null; endAt: Date | null }, now = new Date()) =>
  (!o.startAt || o.startAt <= now) && (!o.endAt || o.endAt >= now);

/** Live offers (active + within date window). `promotedOnly` for marketing/portal. */
export async function liveOffers(promotedOnly = false): Promise<OfferView[]> {
  const rows = await db.serviceOffer.findMany({
    where: { active: true, ...(promotedOnly ? { promoted: true } : {}) },
    orderBy: { createdAt: 'desc' },
  });
  return rows.filter((o) => inWindow(o)).map((o) => ({
    id: o.id, name: o.name, scope: o.scope as OfferView['scope'], serviceId: o.serviceId, variantId: o.variantId,
    percentOff: o.percentOff, amountOffPence: o.amountOffPence, startAt: o.startAt, endAt: o.endAt, promoted: o.promoted,
  }));
}

const offerApplies = (o: OfferView, serviceId: string, variantId: string) =>
  o.scope === 'ALL' ||
  (o.scope === 'SERVICE' && o.serviceId === serviceId) ||
  (o.scope === 'VARIANT' && o.variantId === variantId);

const offerDiscount = (o: OfferView, pricePence: number) =>
  o.percentOff ? Math.round((pricePence * Math.min(100, o.percentOff)) / 100) : Math.min(o.amountOffPence ?? 0, pricePence);

/** Best (largest) offer discount for a variant at a given price, with its label. */
export function bestOffer(offers: OfferView[], serviceId: string, variantId: string, pricePence: number): { discountPence: number; offer: OfferView } | null {
  let best: { discountPence: number; offer: OfferView } | null = null;
  for (const o of offers) {
    if (!offerApplies(o, serviceId, variantId)) continue;
    const d = offerDiscount(o, pricePence);
    if (d > 0 && (!best || d > best.discountPence)) best = { discountPence: d, offer: o };
  }
  return best;
}

export const formatPence = (p: number | null | undefined) =>
  p == null ? 'On consultation' : p === 0 ? 'On consultation' : `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}`;

// ── Public "from" pricing (single source of truth) ───────────────────────────
// Displayed prices on the marketing site derive from the live admin catalogue —
// never hardcoded. The lowest active variant price per treatment is the "from".

export type TreatmentPricing = { fromPence: number | null; variants: VariantView[] };

/** Lowest live price + variants for every treatment, keyed by treatmentSlug.
 *  Memoised per request. Safe (empty) when the CRM/DB isn't available — e.g. the
 *  static demo build — so pages fall back to "On consultation" rather than a
 *  hardcoded number. */
export const pricingByTreatment = cache(async (): Promise<Map<string, TreatmentPricing>> => {
  const map = new Map<string, TreatmentPricing>();
  if (!crmEnabled) return map;
  try {
    for (const s of await listServices(false)) {
      const prev = map.get(s.treatmentSlug);
      const variants = prev ? [...prev.variants, ...s.variants] : s.variants;
      const prices = variants.map((v) => v.pricePence).filter((p) => p > 0);
      map.set(s.treatmentSlug, { fromPence: prices.length ? Math.min(...prices) : null, variants });
    }
  } catch { /* no DB at build/demo → on-consultation fallback */ }
  return map;
});

/** Live pricing for one treatment (lowest price + its variants), or null. */
export async function pricingForTreatment(slug: string): Promise<TreatmentPricing | null> {
  return (await pricingByTreatment()).get(slug) ?? null;
}

/** Lowest live single-session price (pence) for a treatment, or null. */
export async function lowestPenceForTreatment(slug: string): Promise<number | null> {
  return (await pricingForTreatment(slug))?.fromPence ?? null;
}

/** "from £95" / "On consultation" — for the marketing "from" badges. */
export const fromLabel = (pence: number | null | undefined) =>
  pence == null || pence <= 0 ? 'On consultation' : `from ${formatPence(pence)}`;

export type BookingVariant = {
  id: string; name: string; durationMin: number; pricePence: number;
  offerPence: number | null; offerName: string | null;
  courses: Course[];
};
export type BookingService = {
  id: string; slug: string; treatmentSlug: string; name: string; category: string;
  audience: string; variants: BookingVariant[];
};

/** Catalogue shaped for the public booking flow: active services + variants with
 *  any live offer already priced in, plus the marketing audience for upsell
 *  targeting. */
export async function bookingCatalogue(): Promise<BookingService[]> {
  const [services, offers] = await Promise.all([listServices(false), liveOffers(false)]);
  const { getTreatment } = await import('@/lib/treatments');
  return services
    .filter((s) => s.variants.length > 0)
    .map((s) => ({
      id: s.id, slug: s.slug, treatmentSlug: s.treatmentSlug, name: s.name, category: s.category,
      audience: getTreatment(s.treatmentSlug)?.audience ?? 'all',
      variants: s.variants.map((v) => {
        const off = bestOffer(offers, s.id, v.id, v.pricePence);
        return { id: v.id, name: v.name, durationMin: v.durationMin, pricePence: v.pricePence, courses: v.courses, offerPence: off ? Math.max(0, v.pricePence - off.discountPence) : null, offerName: off?.offer.name ?? null };
      }),
    }));
}
