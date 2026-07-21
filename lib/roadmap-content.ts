// ─────────────────────────────────────────────────────────────────────────────
// Curated public roadmap content.
//
// The /roadmap page also renders Build-board items an admin has flagged
// `isPublic`, but that set is often empty or full of engineering noise. This
// hand-authored set guarantees the page is always a real marketing asset:
// genuine, shipped or near-shipped, consumer-facing wins in plain British
// English — no internal jargon, no prescription-only-medicine names, no claims
// we can't stand behind, and no dates we can't commit to.
//
// Source: docs/audit-2026-06/03-roadmap-coming-soon.md §3 (public-safe shortlist).
// Keep B2B/ClinicOS, native-app and government-funding-as-available OUT (see §3
// "hold back" list). Every `href` below is a real, live public route.
// ─────────────────────────────────────────────────────────────────────────────

export type RoadmapStage = 'coming-soon' | 'shipped';

export type RoadmapEntry = {
  /** Stable key — used for React keys and to de-dupe against board items. */
  key: string;
  stage: RoadmapStage;
  title: string;
  detail: string;
  /** Optional link to the real page that delivers this. */
  href?: string;
  /** Link label. */
  cta?: string;
};

export const ROADMAP_CONTENT: RoadmapEntry[] = [
  // ── Coming soon ──────────────────────────────────────────────────────────
  {
    key: 'dentistry',
    stage: 'coming-soon',
    title: 'Cosmetic dentistry at K Clinics',
    detail:
      'Veneers, whitening, bonding and implants — held to the same meticulous standard as everything else we do. Join the waiting list to be first in the chair.',
    href: '/dentistry',
    cta: 'Join the waiting list',
  },
  {
    key: 'kiosk',
    stage: 'coming-soon',
    title: 'Skin & Smile, on the high street',
    detail:
      'Walk past, scan the QR code and discover your skin and smile score in about a minute — then share your result for an exclusive welcome offer.',
    href: '/kiosk',
    cta: 'See how it works',
  },
  {
    key: 'academy-funding',
    stage: 'coming-soon',
    title: 'More ways to fund your training',
    detail:
      'K Academy already offers flexible monthly payment plans. Government-funded training routes are on the way — register your interest to be the first to hear.',
    href: '/academy/funding',
    cta: 'Check your eligibility',
  },

  // ── What's new (shipped) ─────────────────────────────────────────────────
  {
    key: 'ai-plan',
    stage: 'shipped',
    title: 'Your personalised skin & smile plan',
    detail:
      'Share a photo and get a friendly skin and smile read in seconds, with a treatment plan shaped around your goals and budget — always something you can actually book.',
    href: '/ai-consultation',
    cta: 'Try it',
  },
  {
    key: 'booking',
    stage: 'shipped',
    title: 'Smarter, faster booking',
    detail:
      'Book online in under a minute, save your card securely for a smooth check-in, and get gentle reminders before your appointment — no phone tag.',
    href: '/book',
    cta: 'Book now',
  },
  {
    key: 'membership',
    stage: 'shipped',
    title: 'Membership & rewards',
    detail:
      'Earn points on every visit and unlock member-only pricing and perks. The more you treat yourself, the more it gives back.',
    href: '/membership',
    cta: 'Explore membership',
  },
  {
    key: 'gift-cards',
    stage: 'shipped',
    title: 'Design-your-own gift cards',
    detail:
      'Create a beautiful, personalised K Clinics gift card — choose the design, message and delivery date. Now available as a posted physical card too.',
    href: '/gift-vouchers',
    cta: 'Send a gift',
  },
  {
    key: 'academy',
    stage: 'shipped',
    title: 'Train with K Academy',
    detail:
      'Accredited aesthetics training with flexible monthly payment options, taught to the standard our clients feel in the chair.',
    href: '/academy',
    cta: 'Browse courses',
  },
  {
    key: 'live-help',
    stage: 'shipped',
    title: 'Live help, instantly',
    detail:
      'Ask anything about treatments, prices or availability and get an answer straight away — with our team a tap away whenever you need a person.',
    href: '/contact',
    cta: 'Ask us anything',
  },
  {
    key: 'accessibility',
    stage: 'shipped',
    title: 'A site that works better for everyone',
    detail:
      'We have improved colour contrast, form labels and keyboard navigation across the site, so booking and browsing are clearer and easier to use.',
  },
];

export const comingSoonContent = ROADMAP_CONTENT.filter((e) => e.stage === 'coming-soon');
export const shippedContent = ROADMAP_CONTENT.filter((e) => e.stage === 'shipped');
