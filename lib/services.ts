import 'server-only';
import { cache } from 'react';
import { db } from '@/lib/db';
import { crmEnabled } from '@/lib/crm';
import { bookableTreatments } from '@/lib/treatments';

// ── Service catalogue + offer pricing ────────────────────────────────────────
// The CRM-managed catalogue (Service → ServiceVariant) with special offers.
// Marketing copy stays in lib/treatments.ts; price/cost/duration/offers here.

export type Course = { sessions: number; totalPence: number };

// Public presentation state (mirrors the Prisma ServiceStatus enum).
export type ServiceStatus = 'NORMAL' | 'CONSULTATION' | 'COMING_SOON' | 'UNAVAILABLE';

export type VariantView = {
  id: string;
  serviceId: string;
  name: string;
  durationMin: number;
  pricePence: number;
  costPence: number | null;
  courses: Course[];
  status: ServiceStatus | null; // null = inherit the service status
};

export type ServiceView = {
  id: string;
  slug: string;
  treatmentSlug: string;
  name: string;
  category: string;
  vatClass: string | null;
  active: boolean;
  status: ServiceStatus;
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

const toVariant = (v: { id: string; serviceId: string; name: string; durationMin: number; pricePence: number; costPence: number | null; courses: unknown; status?: string | null }): VariantView =>
  ({ id: v.id, serviceId: v.serviceId, name: v.name, durationMin: v.durationMin, pricePence: v.pricePence, costPence: v.costPence, courses: asCourses(v.courses), status: (v.status as ServiceStatus | null) ?? null });

const toServiceStatus = (s: string | null | undefined): ServiceStatus => (s as ServiceStatus) ?? 'NORMAL';

/** Active services with their active variants, ordered for display. */
export async function listServices(includeInactive = false): Promise<ServiceView[]> {
  const rows = await db.service.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: { order: 'asc' },
    include: { variants: { where: includeInactive ? {} : { active: true }, orderBy: { order: 'asc' } } },
  });
  return rows.map((s) => ({
    id: s.id, slug: s.slug, treatmentSlug: s.treatmentSlug, name: s.name, category: s.category, vatClass: s.vatClass, active: s.active, status: toServiceStatus(s.status),
    variants: s.variants.map(toVariant),
  }));
}

export type BookingTreatment = { slug: string; title: string; group: string; variants: { id: string; name: string; durationMin: number; pricePence: number }[] };

/** The treatment list for the staff "New phone booking" modal: a Consultation
 *  option first (BLD-203), then every bookable treatment category with its
 *  specific service variants/areas (BLD-189), each with its own price + duration.
 *  Shared by every entry point — the Bookings page, the dashboard Quick Actions
 *  and the reception view — so all three stay identical (BLD-447). */
export async function loadBookingTreatments(): Promise<BookingTreatment[]> {
  const services = await listServices().catch(() => []);
  const namesBySlug = new Map<string, Set<string>>();
  for (const s of services) namesBySlug.set(s.treatmentSlug, (namesBySlug.get(s.treatmentSlug) ?? new Set()).add(s.name));
  const variantsBySlug = new Map<string, BookingTreatment['variants']>();
  for (const s of services) {
    const multi = (namesBySlug.get(s.treatmentSlug)?.size ?? 0) > 1;
    for (const v of s.variants) {
      const arr = variantsBySlug.get(s.treatmentSlug) ?? [];
      arr.push({ id: v.id, name: multi ? `${s.name} — ${v.name}` : v.name, durationMin: v.durationMin, pricePence: v.pricePence });
      variantsBySlug.set(s.treatmentSlug, arr);
    }
  }
  return [
    { slug: 'consultation', title: 'Consultation', group: 'Consultation', variants: [] },
    ...bookableTreatments.map((tr) => ({ slug: tr.slug, title: tr.title, group: tr.group, variants: variantsBySlug.get(tr.slug) ?? [] })),
  ];
}

export async function getServiceByTreatment(treatmentSlug: string): Promise<ServiceView | null> {
  const s = await db.service.findFirst({
    where: { treatmentSlug, active: true },
    include: { variants: { where: { active: true }, orderBy: { order: 'asc' } } },
  });
  if (!s) return null;
  return { id: s.id, slug: s.slug, treatmentSlug: s.treatmentSlug, name: s.name, category: s.category, vatClass: s.vatClass, active: s.active, status: toServiceStatus(s.status), variants: s.variants.map(toVariant) };
}

/** Effective public status of a variant: its own override, else the service's. */
export const effectiveStatus = (serviceStatus: ServiceStatus, variantStatus: ServiceStatus | null): ServiceStatus =>
  variantStatus ?? serviceStatus;

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

/** A variant priced for public display: original price, any live-offer price,
 *  and its effective presentation status. */
export type PricedVariant = {
  id: string;
  serviceId: string;
  name: string;
  durationMin: number;
  pricePence: number;          // original single-session price
  courses: Course[];
  status: ServiceStatus;       // effective (variant override or service)
  offerPence: number | null;   // discounted single-session price, or null if none
  offerName: string | null;    // the offer's label, when discounted
};

export type TreatmentPricing = {
  status: ServiceStatus;          // service-level headline status
  fromPence: number | null;       // lowest ORIGINAL price among bookable, priced variants
  fromOfferPence: number | null;  // lowest payable price after offers (only if discounted)
  offerName: string | null;       // label for the discounted "from", when discounted
  variants: PricedVariant[];
};

/** Live pricing + presentation status + offers for every treatment, keyed by
 *  treatmentSlug. Memoised per request. Safe (empty) when the CRM/DB isn't
 *  available — e.g. the static demo build — so pages fall back to "On
 *  consultation"/no price rather than a hardcoded number. */
export const pricingByTreatment = cache(async (): Promise<Map<string, TreatmentPricing>> => {
  const map = new Map<string, TreatmentPricing>();
  if (!crmEnabled) return map;
  try {
    const [services, offers] = await Promise.all([listServices(false), liveOffers(false)]);
    const byTreatment = new Map<string, ServiceView[]>();
    for (const s of services) {
      const arr = byTreatment.get(s.treatmentSlug) ?? [];
      arr.push(s);
      byTreatment.set(s.treatmentSlug, arr);
    }
    for (const [slug, svcList] of byTreatment) {
      const variants: PricedVariant[] = [];
      // Headline status: the first non-NORMAL service status, else NORMAL.
      const serviceStatus = svcList.find((s) => s.status !== 'NORMAL')?.status ?? 'NORMAL';
      for (const s of svcList) {
        for (const v of s.variants) {
          const status = effectiveStatus(s.status, v.status);
          const priced = status === 'NORMAL' && v.pricePence > 0;
          const off = priced ? bestOffer(offers, s.id, v.id, v.pricePence) : null;
          variants.push({
            id: v.id, serviceId: v.serviceId, name: v.name, durationMin: v.durationMin,
            pricePence: v.pricePence, courses: v.courses, status,
            offerPence: off ? Math.max(0, v.pricePence - off.discountPence) : null,
            offerName: off?.offer.name ?? null,
          });
        }
      }
      // "from" = lowest original among NORMAL, priced variants; offer "from" tracks
      // the lowest payable price after any live discount.
      const normalPriced = variants.filter((v) => v.status === 'NORMAL' && v.pricePence > 0);
      const fromPence = normalPriced.length ? Math.min(...normalPriced.map((v) => v.pricePence)) : null;
      let fromOfferPence: number | null = null;
      let offerName: string | null = null;
      for (const v of normalPriced) {
        const payable = v.offerPence ?? v.pricePence;
        if (fromOfferPence == null || payable < fromOfferPence) { fromOfferPence = payable; offerName = v.offerName; }
      }
      const discounted = fromOfferPence != null && fromPence != null && fromOfferPence < fromPence;
      map.set(slug, {
        status: serviceStatus,
        fromPence,
        fromOfferPence: discounted ? fromOfferPence : null,
        offerName: discounted ? offerName : null,
        variants,
      });
    }
  } catch { /* no DB at build/demo → on-consultation fallback */ }
  return map;
});

/** Live pricing for one treatment (status + lowest price + its variants), or null. */
export async function pricingForTreatment(slug: string): Promise<TreatmentPricing | null> {
  return (await pricingByTreatment()).get(slug) ?? null;
}

/** Lowest live single-session ORIGINAL price (pence) for a treatment, or null.
 *  (Used as the booking base price; offers/promos are applied on top elsewhere.) */
export async function lowestPenceForTreatment(slug: string): Promise<number | null> {
  return (await pricingForTreatment(slug))?.fromPence ?? null;
}

/** "from £95" / "On consultation" — for the marketing "from" badges. */
export const fromLabel = (pence: number | null | undefined) =>
  pence == null || pence <= 0 ? 'On consultation' : `from ${formatPence(pence)}`;

/** Public label for a presentation status (NORMAL has no badge). */
export const statusLabel = (s: ServiceStatus): string =>
  s === 'CONSULTATION' ? 'On consultation' : s === 'COMING_SOON' ? 'Coming soon' : s === 'UNAVAILABLE' ? 'Currently unavailable' : '';

/** Can this status be booked online? (CONSULTATION books as a £0 hold.) */
export const isBookableStatus = (s: ServiceStatus): boolean => s === 'NORMAL' || s === 'CONSULTATION';

export type BookingVariant = {
  id: string; name: string; durationMin: number; pricePence: number;
  offerPence: number | null; offerName: string | null;
  courses: Course[]; status: ServiceStatus;
};
export type BookingService = {
  id: string; slug: string; treatmentSlug: string; name: string; category: string;
  audience: string; status: ServiceStatus; variants: BookingVariant[];
};

/** Catalogue shaped for the public booking flow: active services + variants with
 *  any live offer already priced in, plus the marketing audience for upsell
 *  targeting. Variants/services that aren't bookable (coming soon / unavailable)
 *  are excluded; "on consultation" variants are kept (booked as a £0 hold). */
export async function bookingCatalogue(): Promise<BookingService[]> {
  const [services, offers] = await Promise.all([listServices(false), liveOffers(false)]);
  const { getTreatment } = await import('@/lib/treatments');
  // Effective service status: onRequest forces "coming soon" only when NORMAL.
  const effSvc = (s: ServiceView): ServiceStatus =>
    s.status === 'NORMAL' && getTreatment(s.treatmentSlug)?.onRequest ? 'COMING_SOON' : s.status;
  return services
    .filter((s) => isBookableStatus(effSvc(s)))
    .map((s) => ({
      id: s.id, slug: s.slug, treatmentSlug: s.treatmentSlug, name: s.name, category: s.category,
      audience: getTreatment(s.treatmentSlug)?.audience ?? 'all', status: s.status,
      variants: s.variants
        .map((v) => {
          const status = effectiveStatus(s.status, v.status);
          const off = status === 'NORMAL' ? bestOffer(offers, s.id, v.id, v.pricePence) : null;
          // On-consultation variants book as a £0 hold; price is kept internal.
          const pricePence = status === 'CONSULTATION' ? 0 : v.pricePence;
          return { id: v.id, name: v.name, durationMin: v.durationMin, pricePence, courses: status === 'CONSULTATION' ? [] : v.courses, offerPence: off ? Math.max(0, v.pricePence - off.discountPence) : null, offerName: off?.offer.name ?? null, status };
        })
        .filter((v) => isBookableStatus(v.status)),
    }))
    .filter((s) => s.variants.length > 0);
}
