import { site } from '@/lib/site';

/**
 * Homepage hero carousel data (BLD-1197). An ordered array so new promotional
 * slides (Laser Hair Removal, HydraFacial Platinum, HIFU, seasonal offers,
 * Black Friday, ...) can be added later by appending an object here — nothing
 * else needs to change.
 *
 * Two slide shapes:
 *  - 'brand'  — the original static hero (clinic branding, tagline, CTAs,
 *    rating strip). Rendered from live `rating` data passed into <Hero>, so it
 *    stays a plain marker here rather than carrying its own copy.
 *  - 'promo'  — a self-contained promotional slide (treatment + price, one
 *    primary booking CTA). Add a new object of this shape for each future
 *    promotion.
 */
export type PromoHeroSlide = {
  id: string;
  kind: 'promo';
  /** Small kicker above the title, e.g. "Special Offer". */
  eyebrow: string;
  /** Slide title, e.g. "Signature Facial". */
  title: string;
  /** One-line promise under the title. */
  tagline: string;
  /** Supporting paragraph. */
  description: string;
  /** Current price, e.g. "£150". */
  price: string;
  /** Struck-through original price, e.g. "£210". */
  wasPrice: string;
  /** Small print under the price, e.g. "Limited-time introductory price." */
  priceNote: string;
  /** Primary CTA. */
  ctaLabel: string;
  ctaHref: string;
  /** Secondary CTA (optional — omit for a single-CTA slide). */
  secondaryLabel?: string;
  secondaryHref?: string;
};

export type BrandHeroSlide = { id: string; kind: 'brand' };

export type HeroSlide = BrandHeroSlide | PromoHeroSlide;

export const HERO_SLIDES: HeroSlide[] = [
  // Slide 1 — the existing static hero, unchanged.
  { id: 'brand', kind: 'brand' },

  // Slide 2 — Signature Facial promotion (BLD-1197).
  {
    id: 'signature-facial',
    kind: 'promo',
    eyebrow: 'Special Offer',
    title: 'Signature Facial',
    tagline: 'Luxury facial, personalised for your skin.',
    description:
      'Our most-loved facial treatment combining deep cleansing, exfoliation, hydration and relaxation for healthy, radiant skin. Personalised to your skin for visible results after every treatment.',
    price: '£150',
    wasPrice: '£210',
    priceNote: 'Limited-time introductory price.',
    ctaLabel: 'Book the Signature Facial',
    // 'face-treatments' is the Signature Facials & Skin treatment page — the
    // ?treatment= query pre-selects it in the booking flow (see
    // components/booking/BookingButtons.tsx for the same pattern).
    ctaHref: `${site.booking.path}?treatment=${encodeURIComponent('face-treatments')}`,
    secondaryLabel: 'Explore Signature Facials',
    secondaryHref: '/face-treatments',
  },

  // Future slides: Laser Hair Removal, HydraFacial Platinum, HIFU, seasonal
  // offers, Black Friday, etc. — append another { kind: 'promo', ... } object.
];
