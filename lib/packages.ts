// Curated treatment packages — the signature, ritualised programmes.
export type Pkg = {
  slug: string;
  name: string;
  subtitle: string;
  description: string;
  includes: string[];
  bestFor: string;
  priceFrom?: string;
  gradient: [string, string];
  related: string[];
};

export const packages: Pkg[] = [
  {
    slug: 'total-rejuvenation',
    name: 'Total Rejuvenation',
    subtitle: 'Full face & body renewal',
    description:
      'Our most complete programme — a curated year of face and body treatments that lift, resurface and refine in concert, for a head-to-toe transformation that builds beautifully over time.',
    includes: [
      'SMAS HIFU facial lift',
      'A course of RF skin tightening',
      'Laser skin resurfacing or Carbon Peel course',
      'HydraGlow facial ritual',
      'Personalised body contouring',
    ],
    bestFor: 'A comprehensive, year-long renewal of face and body.',
    priceFrom: 'On consultation',
    gradient: ['#a98a6d', '#7b6a5d'],
    related: ['smas-hifu-lifting', 'rf-lifting', 'body-contouring'],
  },
  {
    slug: 'perfect-skin',
    name: 'Perfect Skin',
    subtitle: 'Clarity for acne & pigmentation',
    description:
      'A targeted programme for clearer, more even skin — combining medical-grade peels, the Carbon Laser Peel and prescriptive facials to address acne, congestion and pigmentation at their source.',
    includes: [
      'Carbon Laser Peel course',
      'Prescriptive chemical peels',
      'Microneedling for texture & scarring',
      'HydraGlow deep-cleanse facials',
      'Tailored homecare guidance',
    ],
    bestFor: 'Acne-prone, congested or unevenly pigmented skin.',
    priceFrom: 'On consultation',
    gradient: ['#cdb4a3', '#c2a589'],
    related: ['carbon-laser-peel', 'face-treatments', 'hydraglow-facial'],
  },
  {
    slug: 'smooth-and-slim',
    name: 'Smooth & Slim',
    subtitle: 'Toned, sculpted, cellulite-free',
    description:
      'A body-defining course pairing Endosphere micro-vibration with anti-cellulite vacuum therapy and radiofrequency — smoothing cellulite, firming skin and sculpting more harmonious contours.',
    includes: [
      '6 × Endosphere sessions',
      '6 × anti-cellulite vacuum therapy',
      'RF body tightening',
      'Lymphatic drainage focus',
      'Progress tracking',
    ],
    bestFor: 'Smoothing cellulite and sculpting body contours.',
    priceFrom: 'On consultation',
    gradient: ['#c2a589', '#3d352f'],
    related: ['body-contouring', 'rf-lifting', 'smas-hifu-lifting'],
  },
  {
    slug: 'ultimate-hair-free-women',
    name: 'Ultimate Hair-Free — Women',
    subtitle: 'Full-body smoothness, for good',
    description:
      'The definitive laser hair removal programme for women — a structured course across your chosen areas, designed to retire the follicle and deliver permanently smooth, maintenance-free skin.',
    includes: [
      'Full course of laser hair removal',
      'Multiple body & facial areas',
      'Patch test & tailored protocol',
      'Spaced to the growth cycle',
      'Maintenance guidance',
    ],
    bestFor: 'Women seeking permanent, full-body hair reduction.',
    priceFrom: 'On consultation',
    gradient: ['#c2a589', '#7b6a5d'],
    related: ['laser-hair-removal', 'carbon-laser-peel', 'hydraglow-facial'],
  },
];

export const getPackage = (slug: string) => packages.find((p) => p.slug === slug);
