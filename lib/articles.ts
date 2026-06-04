// Journal / blog — original, SEO-targeted articles for KClinics. Pure data
// (client-safe). Each article maps to a treatment area and target keywords to
// build topical authority. Keep paragraphs tight and genuinely useful.

export type ArticleBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'ul'; items: string[] };

export type Article = {
  slug: string;
  title: string;
  excerpt: string;
  metaDescription: string;
  category: 'Skin' | 'Laser' | 'Injectables' | 'Dentistry' | 'Wellbeing';
  readMinutes: number;
  published: string; // ISO date
  updated?: string;
  keywords: string[];
  /** Image filename in /public/treatments (optional). */
  image?: string;
  /** Related treatment slugs for in-article CTAs. */
  related?: string[];
  blocks: ArticleBlock[];
};

export const articles: Article[] = [
  {
    slug: 'laser-hair-removal-what-to-expect',
    title: 'Laser Hair Removal: What to Expect, Start to Finish',
    excerpt:
      'How laser hair removal actually works, how many sessions you’ll need, and how to get the smoothest, longest-lasting results.',
    metaDescription:
      'A clear guide to laser hair removal in London — how it works, how many sessions you need, what it feels like, and how to prepare and aftercare for the best results.',
    category: 'Laser',
    readMinutes: 6,
    published: '2026-02-10',
    keywords: ['laser hair removal London', 'how many laser hair removal sessions', 'laser hair removal aftercare'],
    image: 'Laser-Hair-Removal-1-1.png',
    related: ['laser-hair-removal', 'laser-hair-removal-for-men'],
    blocks: [
      { type: 'p', text: 'Laser hair removal is one of the most requested treatments in aesthetics — and for good reason. Done well, it offers a long-term reduction in unwanted hair with minimal upkeep. Here’s exactly what to expect.' },
      { type: 'h2', text: 'How laser hair removal works' },
      { type: 'p', text: 'A professional laser targets the pigment (melanin) in the hair follicle. The light energy converts to heat, disabling the follicle’s ability to regrow hair — without damaging the surrounding skin. Because hair grows in cycles, only follicles in their active phase respond at each session, which is why a course is needed.' },
      { type: 'h2', text: 'How many sessions will I need?' },
      { type: 'p', text: 'Most clients see meaningful results after 6–8 sessions, spaced four to six weeks apart. Coarser or hormonally-driven hair may need a few more. Maintenance is typically just one or two top-ups a year.' },
      { type: 'h2', text: 'Does it hurt?' },
      { type: 'p', text: 'Modern systems use contact cooling, so most people describe it as a quick, warm “snap”. Comfortable, fast, and far gentler than waxing or epilation.' },
      { type: 'h2', text: 'Preparing for your session' },
      { type: 'ul', items: ['Shave the area 24 hours before (don’t wax or pluck — the root must be intact)', 'Avoid sun exposure and self-tan for two weeks beforehand', 'Skip retinoids and strong acids on the area for a few days', 'Arrive with clean, product-free skin'] },
      { type: 'h2', text: 'Aftercare for the best results' },
      { type: 'p', text: 'Keep the area cool and protected, use SPF daily, and avoid heat (saunas, hot workouts) for 48 hours. Some shedding over the following week is normal and a good sign the treatment is working.' },
      { type: 'p', text: 'At KClinics, every course begins with a complimentary consultation and patch test, so your protocol is calibrated to your skin tone and hair type for safe, effective results.' },
    ],
  },
  {
    slug: 'anti-wrinkle-injections-natural-results',
    title: 'Anti-Wrinkle Injections: How to Get Natural-Looking Results',
    excerpt:
      'The difference between “frozen” and refined — and how an artful, conservative approach keeps your expressions intact.',
    metaDescription:
      'Anti-wrinkle injections in London explained — how they work, what natural results look like, longevity, and how to choose a clinician for a refreshed, never-frozen look.',
    category: 'Injectables',
    readMinutes: 5,
    published: '2026-02-24',
    keywords: ['anti-wrinkle injections London', 'natural botox results', 'how long do anti-wrinkle injections last'],
    image: 'HydraFacial-Anti-Ageing.png',
    related: ['cosmetic-injections'],
    blocks: [
      { type: 'p', text: 'The best anti-wrinkle treatment is the one no one can quite identify. The goal isn’t a frozen face — it’s a softened, well-rested version of you. Here’s how that’s achieved.' },
      { type: 'h2', text: 'What anti-wrinkle injections do' },
      { type: 'p', text: 'They temporarily relax the specific muscles responsible for dynamic lines — the creases that form when you frown, squint or raise your brows. Soften the movement, and the lines that movement creates soften too.' },
      { type: 'h2', text: 'The art of looking natural' },
      { type: 'p', text: 'Natural results come from precise, conservative dosing and a deep understanding of facial anatomy. A skilled clinician treats only what’s needed and preserves your ability to express — so you look refreshed, not altered.' },
      { type: 'h2', text: 'How long do results last?' },
      { type: 'p', text: 'Typically three to four months. Many clients settle into a rhythm of two to three treatments a year, and find lines soften over time as the habit of over-using those muscles fades.' },
      { type: 'h2', text: 'Choosing your clinician' },
      { type: 'ul', items: ['Look for medically-qualified, registered practitioners', 'Ask to see natural, realistic before-and-afters', 'Expect a thorough consultation and honest advice — including when not to treat', 'Never choose on price alone'] },
      { type: 'p', text: 'Every injectable treatment at KClinics begins with a full consultation and a tailored plan, delivered by experienced clinicians with an artist’s eye for balance.' },
    ],
  },
  {
    slug: 'achieve-the-perfect-smile-veneers-whitening',
    title: 'How to Achieve the Perfect Smile: Veneers vs Whitening',
    excerpt:
      'From a simple brightening to a full smile design — understanding your options for a confident, natural smile.',
    metaDescription:
      'Veneers or teeth whitening? A clear guide to achieving the perfect smile in London — what each option does, who they suit, longevity and how smile design works.',
    category: 'Dentistry',
    readMinutes: 6,
    published: '2026-03-09',
    keywords: ['porcelain veneers London', 'teeth whitening London', 'smile makeover', 'how to get a perfect smile'],
    image: 'baner-7.jpg',
    related: ['veneers', 'teeth-whitening'],
    blocks: [
      { type: 'p', text: 'A confident smile is one of the most transformative things aesthetic dentistry can offer. But the right route depends entirely on your starting point and your goals.' },
      { type: 'h2', text: 'Professional teeth whitening' },
      { type: 'p', text: 'If your teeth are healthy and well-aligned but have dulled or stained over time, whitening is often all you need. In-clinic and at-home professional systems lift years of staining safely, with results far beyond anything available on the high street.' },
      { type: 'h2', text: 'Porcelain veneers' },
      { type: 'p', text: 'Veneers are wafer-thin shells bonded to the front of the teeth. They’re the gold standard when you want to change shape, close gaps, correct minor alignment or achieve a uniform, bright finish — a complete smile design rather than a colour change.' },
      { type: 'h2', text: 'Which is right for me?' },
      { type: 'ul', items: ['Whitening: healthy teeth, good shape, just want them brighter', 'Bonding: small chips, gaps or reshaping on a budget', 'Veneers: a comprehensive, lasting smile transformation', 'Often, a combination — whiten first, then refine'] },
      { type: 'h2', text: 'How long do veneers last?' },
      { type: 'p', text: 'With good care, quality porcelain veneers can last 10–15 years or more. They resist staining beautifully and, designed well, look entirely natural.' },
      { type: 'p', text: 'At KClinics, smile design starts with listening — we craft a smile that looks like yours, only better, and show you a preview before any treatment begins.' },
    ],
  },
  {
    slug: 'skincare-after-laser-treatments',
    title: 'How to Care for Your Skin After Laser Treatments',
    excerpt:
      'The simple aftercare habits that protect your results and keep your skin calm, healthy and glowing.',
    metaDescription:
      'Expert aftercare for laser skin treatments — how to soothe, protect and get the best long-term results from laser facials, resurfacing and pigmentation treatments.',
    category: 'Skin',
    readMinutes: 4,
    published: '2026-03-20',
    keywords: ['laser treatment aftercare', 'skincare after laser', 'laser facial recovery London'],
    image: 'Carbon-Laser-Peel.png',
    related: ['hydraglow-facial', 'laser-skin-rejuvenation'],
    blocks: [
      { type: 'p', text: 'Laser skin treatments work by stimulating your skin’s natural renewal. What you do in the days afterwards has a real impact on both comfort and results.' },
      { type: 'h2', text: 'The first 48 hours' },
      { type: 'ul', items: ['Keep skin cool and hydrated — a gentle, fragrance-free moisturiser is ideal', 'Avoid heat: saunas, steam, hot showers and intense exercise', 'Don’t pick or exfoliate — let the skin settle naturally', 'Wear a high-factor SPF every single day, even indoors near windows'] },
      { type: 'h2', text: 'The first two weeks' },
      { type: 'p', text: 'Pause active ingredients like retinoids and strong acids until your clinician advises. Keep your routine simple — cleanse, hydrate, protect. Some mild redness or a “sandpaper” texture is normal as the skin renews.' },
      { type: 'h2', text: 'Protecting your investment' },
      { type: 'p', text: 'Sun protection is the single most important habit. UV exposure undoes results and risks pigmentation, so daily SPF 50 is non-negotiable — particularly after treatments targeting tone and pigmentation.' },
      { type: 'p', text: 'Your KClinics clinician will give you a personalised aftercare plan and check in on your progress, so your skin stays calm and your results last.' },
    ],
  },
  {
    slug: 'hifu-vs-rf-non-surgical-lifting',
    title: 'HIFU vs RF: Which Non-Surgical Lift Is Right for You?',
    excerpt:
      'Two of the most effective ways to lift and tighten without surgery — how they differ, and how to choose.',
    metaDescription:
      'HIFU vs radiofrequency (RF) skin tightening in London — how each non-surgical lifting treatment works, what they treat best, downtime and results, and how to choose.',
    category: 'Skin',
    readMinutes: 5,
    published: '2026-04-02',
    keywords: ['HIFU London', 'RF skin tightening London', 'non-surgical facelift', 'skin tightening treatment'],
    image: 'Body-SMAS-HIFU-Lifting-1.png',
    related: ['smas-hifu-lifting', 'rf-lifting'],
    blocks: [
      { type: 'p', text: 'If you’d like to lift and firm without surgery or injectables, two technologies lead the field: HIFU and radiofrequency (RF). Both work with your body’s own collagen — they just take different routes there.' },
      { type: 'h2', text: 'HIFU — depth and definition' },
      { type: 'p', text: 'High-Intensity Focused Ultrasound delivers energy to precise depths beneath the skin, including the SMAS layer that surgeons tighten in a facelift. It’s ideal for a defined lift along the jaw, brow and neck, with results that build over three to six months as new collagen forms.' },
      { type: 'h2', text: 'RF — texture and tightening' },
      { type: 'p', text: 'Radiofrequency heats the deeper layers of the skin more broadly, stimulating collagen and improving laxity, texture and fine lines. It’s gentle, comfortable, and excellent for overall firmness and a refreshed surface.' },
      { type: 'h2', text: 'How to choose' },
      { type: 'ul', items: ['Want a defined lift along the jaw/neck? HIFU is often the answer', 'Focused on overall firmness, texture and glow? RF excels', 'Prefer minimal sessions? HIFU is typically once a year', 'Like a gradual, comfortable routine? RF suits a short course', 'Often the two are combined for a complete result'] },
      { type: 'p', text: 'There’s no universal “best” — only what’s best for your face and goals. At your complimentary consultation we assess your skin and recommend the right path, or a tailored combination.' },
    ],
  },
  {
    slug: 'preparing-for-your-first-consultation',
    title: 'Preparing for Your First Consultation at KClinics',
    excerpt:
      'What happens at a complimentary consultation, what to bring, and how to get the most from your visit.',
    metaDescription:
      'What to expect at your first aesthetics or dentistry consultation at KClinics, London — how it works, what to bring, and the questions to ask for a confident decision.',
    category: 'Wellbeing',
    readMinutes: 4,
    published: '2026-04-15',
    keywords: ['aesthetic consultation London', 'free consultation clinic', 'what to expect consultation'],
    image: 'HydraFacial-Anti-Ageing.png',
    related: ['cosmetic-injections', 'veneers'],
    blocks: [
      { type: 'p', text: 'Every great result begins with a great consultation. At KClinics it’s complimentary, unhurried and entirely no-obligation — here’s how to make the most of it.' },
      { type: 'h2', text: 'What happens during your visit' },
      { type: 'p', text: 'Your clinician will listen to your goals, assess your skin, smile or area of concern, talk you through the realistic options, and design a plan around you. You’ll get honest advice — including, sometimes, that less is more or that now isn’t the right time.' },
      { type: 'h2', text: 'What to bring' },
      { type: 'ul', items: ['A list of any medications, allergies or medical conditions', 'Notes on what you’d love to change — and any concerns', 'Photos, if there’s a look you’re drawn to', 'Your questions — no question is too small'] },
      { type: 'h2', text: 'Questions worth asking' },
      { type: 'ul', items: ['What results are realistic for me, and in what timeframe?', 'How many sessions, and what’s the total investment?', 'What’s the aftercare and downtime?', 'What are the risks, and how are they managed?'] },
      { type: 'p', text: 'You’ll never be pressured to decide on the day. Take your time — and when you’re ready, we’ll be here. New clients also enjoy 15% off their first treatment.' },
    ],
  },
];

export const articleCategories = ['Skin', 'Laser', 'Injectables', 'Dentistry', 'Wellbeing'] as const;
export const getArticle = (slug: string) => articles.find((a) => a.slug === slug);
export const articleSlugs = articles.map((a) => a.slug);
// Newest first for listings.
export const sortedArticles = [...articles].sort((a, b) => +new Date(b.published) - +new Date(a.published));
