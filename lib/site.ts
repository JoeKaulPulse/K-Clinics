// ─────────────────────────────────────────────────────────────────────────────
// Central site configuration. Edit business details, booking links and
// navigation here — everything else reads from this single source of truth.
// ─────────────────────────────────────────────────────────────────────────────

export const site = {
  name: 'KClinics',
  // The trading name's sole legal entity (aesthetics & laser). Not VAT registered.
  // A separate company will operate the dental services once that launches.
  legalName: 'KCLINICS SKIN & LASER LIMITED',
  companyNumber: '17101088',
  tagline: 'Aesthetics & Aesthetic Dentistry, Reimagined',
  // Used for absolute URLs (metadata, sitemap, JSON-LD). Update at launch.
  url: 'https://kclinics.co.uk',
  locale: 'en_GB',
  description:
    'KClinics is an Islington clinic uniting advanced laser & skin aesthetics with aesthetic dentistry — precision treatments, qualified clinicians, and an experience designed around you.',

  // ── Contact / NAP (Name, Address, Phone) ───────────────────────────────────
  // Landline via yay.com VoIP. All public phone references read from here.
  phone: '020 8050 0750',
  phoneHref: 'tel:+442080500750',
  // WhatsApp business number (digits only, intl format). Overridable via env.
  whatsapp: '442080500750',
  email: 'support@kclinics.co.uk',
  emailHref: 'mailto:support@kclinics.co.uk',
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
    'https://www.google.com/maps?q=4+Charterhouse+Buildings+Goswell+Road+London+EC1M+7AN&output=embed',
  mapLink: 'https://maps.app.goo.gl/AqSgHBRKDQaUa7Kx9',

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
    phoneCta: 'tel:+442080500750',
  },

  // ── Social ──────────────────────────────────────────────────────────────────
  social: {
    instagram: 'https://www.instagram.com/kclinics',
    facebook: 'https://www.facebook.com/kclinics',
    tiktok: 'https://www.tiktok.com/@kclinics',
  },

  // ── Service availability ────────────────────────────────────────────────────
  // Dentistry can only be offered/advertised once a GDC-registered dentist is in
  // post. Until then this stays false: the dentistry pages show "opening soon"
  // with a register-interest form instead of booking. Flip to true when ready.
  dentistryLive: false,

  // ── Trust signals ───────────────────────────────────────────────────────────
  // Opened 2026. Ratings/review counts are NOT hard-coded — they are computed
  // live from real reviews (our own CRM + Google) via lib/reviews-aggregate.ts.
  // If there are no real reviews yet, rating widgets simply don't render.
  founded: '2026',
} as const;

export type Site = typeof site;
