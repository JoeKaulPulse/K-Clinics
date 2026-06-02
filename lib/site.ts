// ─────────────────────────────────────────────────────────────────────────────
// Central site configuration. Edit business details, booking links and
// navigation here — everything else reads from this single source of truth.
// ─────────────────────────────────────────────────────────────────────────────

export const site = {
  name: 'KClinics',
  legalName: 'KClinics London',
  tagline: 'Aesthetics & Aesthetic Dentistry, Reimagined',
  // Used for absolute URLs (metadata, sitemap, JSON-LD). Update at launch.
  url: 'https://kclinics.co.uk',
  locale: 'en_GB',
  description:
    'KClinics is a premium Islington clinic uniting advanced laser & skin aesthetics with award-worthy aesthetic dentistry — precision treatments, world-class clinicians, and an experience designed around you.',

  // ── Contact / NAP (Name, Address, Phone) ───────────────────────────────────
  // PLACEHOLDERS — replace with verified details before launch.
  phone: '+44 20 7250 0000',
  phoneHref: 'tel:+442072500000',
  email: 'hello@kclinics.co.uk',
  emailHref: 'mailto:hello@kclinics.co.uk',
  address: {
    street: '4 Charterhouse Buildings, Goswell Road',
    locality: 'Clerkenwell, Islington',
    region: 'London',
    postalCode: 'EC1M 7AN',
    country: 'GB',
    countryName: 'United Kingdom',
  },
  geo: { latitude: 51.5226, longitude: -0.0996 },
  mapEmbed:
    'https://www.google.com/maps?q=4+Charterhouse+Buildings+Goswell+Road+London+EC1M&output=embed',
  mapLink: 'https://maps.google.com/?q=4+Charterhouse+Buildings,+Goswell+Road,+London+EC1M',

  // ── Opening hours (24h, used for display + schema.org) ──────────────────────
  hours: [
    { day: 'Monday', dow: 'Mo', open: '09:00', close: '19:00' },
    { day: 'Tuesday', dow: 'Tu', open: '09:00', close: '19:00' },
    { day: 'Wednesday', dow: 'We', open: '09:00', close: '19:00' },
    { day: 'Thursday', dow: 'Th', open: '09:00', close: '20:00' },
    { day: 'Friday', dow: 'Fr', open: '09:00', close: '19:00' },
    { day: 'Saturday', dow: 'Sa', open: '10:00', close: '17:00' },
    { day: 'Sunday', dow: 'Su', open: 'Closed', close: 'Closed' },
  ],

  // ── Booking ───────────────────────────────────────────────────────────────
  // First-party booking (Stripe-backed). Treatwell/Fresha removed.
  booking: {
    path: '/book',
    phoneCta: 'tel:+442072500000',
  },

  // ── Social ──────────────────────────────────────────────────────────────────
  social: {
    instagram: 'https://www.instagram.com/kclinics',
    facebook: 'https://www.facebook.com/kclinics',
    tiktok: 'https://www.tiktok.com/@kclinics',
  },

  // ── Trust signals ───────────────────────────────────────────────────────────
  founded: '2016',
  ratingValue: '4.9',
  reviewCount: '480',
} as const;

export type Site = typeof site;
