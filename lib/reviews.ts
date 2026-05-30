export type Review = { name: string; treatment: string; quote: string; location?: string };

// Representative client testimonials. Replace with verified reviews at launch.
export const reviews: Review[] = [
  {
    name: 'Sophia R.',
    treatment: 'Laser Hair Removal',
    location: 'Clerkenwell',
    quote:
      'After years of routines that never lasted, my skin is finally, properly smooth. The team made every session feel calm and considered — never rushed.',
  },
  {
    name: 'James T.',
    treatment: 'Porcelain Veneers',
    location: 'Shoreditch',
    quote:
      'They designed a smile that looks like mine, only better. People keep telling me I look well — no one can put their finger on why. That is the art of it.',
  },
  {
    name: 'Amara K.',
    treatment: 'SMAS HIFU Lifting',
    location: 'Angel',
    quote:
      'A genuine lift along my jaw without a single needle or day off. The result crept up over a few weeks and I could not be happier.',
  },
  {
    name: 'Elena M.',
    treatment: 'HydraGlow Facial',
    location: 'Barbican',
    quote:
      'I came in before a wedding and left luminous. It has become my monthly ritual — the only facial that gives me an actual glow.',
  },
  {
    name: 'Daniel O.',
    treatment: 'Carbon Laser Peel',
    location: 'Farringdon',
    quote:
      'My skin has never looked clearer. Pores refined, tone even, and zero downtime — straight back to the office looking like I had been on holiday.',
  },
  {
    name: 'Priya S.',
    treatment: 'Cosmetic Injectables',
    location: 'Islington',
    quote:
      'Refined, natural, and never overdone. They listened, treated conservatively, and the result is simply a fresher version of me.',
  },
];
