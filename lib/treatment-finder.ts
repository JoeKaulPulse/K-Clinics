// Treatment finder — a short, friendly quiz that maps a client's goals to
// recommended K Clinics treatments. Pure data (client-safe). The recommendation
// is indicative; every plan is confirmed at a complimentary consultation.

export type FinderOption = {
  value: string;
  label: string;
  /** Treatment slugs this answer points toward, with a weight. */
  suggests: { slug: string; weight: number }[];
};

export type FinderQuestion = {
  id: string;
  prompt: string;
  help?: string;
  multi?: boolean;
  options: FinderOption[];
};

export const finderQuestions: FinderQuestion[] = [
  {
    id: 'focus',
    prompt: 'What would you most love to improve?',
    options: [
      { value: 'skin', label: 'Skin quality & glow', suggests: [{ slug: 'hydraglow-facial', weight: 3 }, { slug: 'carbon-laser-peel', weight: 2 }] },
      { value: 'hair', label: 'Unwanted hair', suggests: [{ slug: 'laser-hair-removal', weight: 3 }] },
      { value: 'lines', label: 'Lines & firmness', suggests: [{ slug: 'cosmetic-injections', weight: 3 }, { slug: 'smas-hifu-lifting', weight: 2 }, { slug: 'rf-lifting', weight: 2 }] },
      { value: 'smile', label: 'My smile', suggests: [{ slug: 'veneers', weight: 3 }, { slug: 'teeth-whitening', weight: 2 }] },
      { value: 'body', label: 'Body contour', suggests: [{ slug: 'body-contouring', weight: 3 }] },
    ],
  },
  {
    id: 'concern',
    prompt: 'Which best describes your main concern?',
    multi: true,
    help: 'Choose any that resonate.',
    options: [
      { value: 'dullness', label: 'Dullness / uneven tone', suggests: [{ slug: 'carbon-laser-peel', weight: 2 }, { slug: 'hydraglow-facial', weight: 2 }] },
      { value: 'pigmentation', label: 'Pigmentation / sun damage', suggests: [{ slug: 'carbon-laser-peel', weight: 3 }] },
      { value: 'laxity', label: 'Loss of firmness', suggests: [{ slug: 'smas-hifu-lifting', weight: 3 }, { slug: 'rf-lifting', weight: 2 }] },
      { value: 'wrinkles', label: 'Fine lines & wrinkles', suggests: [{ slug: 'cosmetic-injections', weight: 3 }] },
      { value: 'hairgrowth', label: 'Regrowth after shaving/waxing', suggests: [{ slug: 'laser-hair-removal', weight: 3 }] },
      { value: 'teethcolour', label: 'Tooth colour / alignment', suggests: [{ slug: 'veneers', weight: 2 }, { slug: 'teeth-whitening', weight: 2 }] },
    ],
  },
  {
    id: 'commitment',
    prompt: 'How would you like to approach it?',
    options: [
      { value: 'quick', label: 'A quick refresh', suggests: [{ slug: 'hydraglow-facial', weight: 1 }, { slug: 'teeth-whitening', weight: 1 }] },
      { value: 'plan', label: 'A considered plan over time', suggests: [{ slug: 'laser-hair-removal', weight: 1 }, { slug: 'smas-hifu-lifting', weight: 1 }] },
      { value: 'transform', label: 'A real transformation', suggests: [{ slug: 'veneers', weight: 1 }, { slug: 'cosmetic-injections', weight: 1 }] },
    ],
  },
];

/** Score answers and return the top treatment slugs. */
export function scoreFinder(answers: Record<string, string | string[]>): string[] {
  const score = new Map<string, number>();
  for (const q of finderQuestions) {
    const a = answers[q.id];
    const chosen = Array.isArray(a) ? a : a ? [a] : [];
    for (const val of chosen) {
      const opt = q.options.find((o) => o.value === val);
      if (!opt) continue;
      for (const s of opt.suggests) score.set(s.slug, (score.get(s.slug) ?? 0) + s.weight);
    }
  }
  return [...score.entries()].sort((a, b) => b[1] - a[1]).map(([slug]) => slug);
}
