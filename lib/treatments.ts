// ─────────────────────────────────────────────────────────────────────────────
// Treatment content model. Each entry renders a premium, SEO-optimised page via
// app/[slug]/page.tsx. Copy is written to read as "ultra-premium clinic".
// ─────────────────────────────────────────────────────────────────────────────
import { importedTreatments } from './treatments-imported';

export type Faq = { q: string; a: string };
export type Benefit = { title: string; text: string };
export type Step = { title: string; text: string };

export type Treatment = {
  slug: string;
  category: 'aesthetics' | 'dentistry';
  group: string;
  title: string;
  menuTitle?: string;
  /** One-line poetic promise shown under the hero title. */
  tagline: string;
  /** SEO */
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  eyebrow: string;
  /** Opening editorial paragraph(s). */
  intro: string;
  benefits: Benefit[];
  process: Step[];
  faqs: Faq[];
  facts: { label: string; value: string }[];
  priceFrom?: string;
  related: string[];
  /** Two-stop gradient used for the page's generative hero art (no baked text). */
  gradient: [string, string];
  accent?: string;
  /** Booking: fixed price in pence (null/undefined = "on consultation", £0 hold). */
  pricePence?: number | null;
  /** Booking: appointment length in minutes. */
  durationMin?: number;
  /** Who a treatment is clinically aimed at. Defaults to 'all' (unisex). Used to
   *  tailor recommendations — never to exclude clients who haven't told us their
   *  gender, or who are non-binary / other / prefer-not-to-say. */
  audience?: 'all' | 'female' | 'male';
  /** Available-on-request: the treatment stays on the website but online booking
   *  is closed (e.g. the machine isn't in yet — "coming soon"). The page shows an
   *  enquiry CTA instead of Book, and the booking API rejects it. */
  onRequest?: boolean;
};

/** Audiences to hide from a client's *recommendations* given their gender.
 *  Inclusive by default: anyone who is non-binary, other, undisclosed, or who
 *  hasn't set a gender sees the full menu. */
export function hiddenAudiences(gender?: string | null): ('female' | 'male')[] {
  if (gender === 'FEMALE') return ['male'];
  if (gender === 'MALE') return ['female'];
  return [];
}

/** Should this treatment be recommended to a client of the given gender? */
export function suitableForGender(t: Pick<Treatment, 'audience'>, gender?: string | null): boolean {
  const aud = t.audience ?? 'all';
  if (aud === 'all') return true;
  return !hiddenAudiences(gender).includes(aud);
}

export const treatments: Treatment[] = [
  // ───────────────────────────── AESTHETICS ─────────────────────────────────
  {
    slug: 'laser-hair-removal',
    category: 'aesthetics',
    group: 'Laser & Skin',
    title: 'Laser Hair Removal',
    tagline: 'The end of the endless routine. Skin, simplified.',
    metaTitle: 'Laser Hair Removal in London (Islington) | K Clinics',
    metaDescription:
      'Medical-grade laser hair removal in Islington, London. Permanent hair reduction for face & body, all skin tones, with expert clinicians at K Clinics. Free consultation.',
    keywords: ['laser hair removal London', 'laser hair removal Islington', 'permanent hair reduction', 'diode laser'],
    eyebrow: 'Laser & Skin',
    intro:
      'Reclaim hours of your life and the quiet confidence of permanently smooth skin. Our medical-grade diode platform targets the follicle with pinpoint precision and a cooled, comfortable touch — delivering lasting hair reduction across face and body, calibrated to your individual skin tone and hair type.',
    benefits: [
      { title: 'Permanent reduction', text: 'A structured course retires the follicle for good — not a temporary fix, but a lasting result.' },
      { title: 'Every skin tone', text: 'Advanced wavelength control makes treatment safe and effective across the full spectrum of skin types.' },
      { title: 'Cooled comfort', text: 'Integrated contact cooling means most clients describe little more than a warm flick.' },
      { title: 'Speed & precision', text: 'Large areas treated in minutes, fine areas with surgical accuracy.' },
    ],
    process: [
      { title: 'Consultation & patch test', text: 'We map your hair, assess skin response and design a course calibrated to you.' },
      { title: 'Your sessions', text: 'Treatments are spaced to follow the hair growth cycle for maximum clearance.' },
      { title: 'Lasting smoothness', text: 'Most clients see dramatic reduction within a course, with occasional maintenance.' },
    ],
    faqs: [
      { q: 'How many sessions will I need?', a: 'Most areas respond beautifully over 6–8 sessions, spaced four to six weeks apart, as hair is only treatable in its active growth phase.' },
      { q: 'Does it hurt?', a: 'Our system pairs each pulse with contact cooling. Most clients find it very tolerable — a brief, warm sensation rather than pain.' },
      { q: 'Can you treat darker skin tones?', a: 'Yes. Our wavelength and energy settings are tailored to treat all skin tones safely and effectively.' },
    ],
    facts: [
      { label: 'Course', value: '6–8 sessions' },
      { label: 'Interval', value: '4–6 weeks' },
      { label: 'Downtime', value: 'None' },
    ],
    priceFrom: '£11',
    related: ['laser-hair-removal-for-men', 'carbon-laser-peel', 'hydraglow-facial'],
    gradient: ['#c2a589', '#7b6a5d'],
  },
  {
    slug: 'laser-hair-removal-for-men',
    category: 'aesthetics',
    group: 'Laser & Skin',
    title: 'Laser Hair Removal for Men',
    menuTitle: 'Laser Hair Removal — Men',
    audience: 'male',
    tagline: 'Groomed, effortless, permanent. Engineered for him.',
    metaTitle: "Men's Laser Hair Removal London | Back, Chest & Beard | K Clinics",
    metaDescription:
      "Men's laser hair removal in Islington, London. Back, chest, shoulders, beard-line shaping and more with medical-grade lasers at K Clinics. Discreet, powerful, lasting.",
    keywords: ['mens laser hair removal London', 'back hair removal', 'beard line laser', 'male grooming London'],
    eyebrow: 'Laser & Skin',
    intro:
      'Coarse, dense hair meets its match. From full backs and shoulders to sharp beard-line definition, our higher-energy protocols are built for the demands of male hair — delivering clean, low-maintenance results without the daily routine.',
    benefits: [
      { title: 'Built for coarse hair', text: 'Higher-energy protocols tuned to dense, stubborn male hair growth.' },
      { title: 'Beard-line sculpting', text: 'Precision shaping for a crisp, defined neckline that never needs trimming.' },
      { title: 'End ingrowns', text: 'Permanently reduce razor bumps and ingrown hairs on the neck and body.' },
      { title: 'Discreet & fast', text: 'A private clinic experience; large areas handled in a single appointment.' },
    ],
    process: [
      { title: 'Assessment & patch test', text: 'We assess density and skin response, then build your tailored course.' },
      { title: 'Targeted sessions', text: 'Spaced with the growth cycle for the cleanest possible clearance.' },
      { title: 'Maintenance-free', text: 'Enjoy smooth, defined results with only occasional top-ups.' },
    ],
    faqs: [
      { q: 'Can you shape my beard line without removing the beard?', a: 'Absolutely — we define the neck and cheek lines precisely while preserving the beard you want to keep.' },
      { q: 'Is back and shoulder hair treatable in one go?', a: 'Yes. These larger areas are typically completed within a single, efficient appointment.' },
      { q: 'Will it stop ingrown hairs?', a: 'Reducing the hair at the follicle dramatically reduces — and often eliminates — ingrown hairs and razor irritation.' },
    ],
    facts: [
      { label: 'Course', value: '6–8 sessions' },
      { label: 'Popular areas', value: 'Back · Chest · Neckline' },
      { label: 'Downtime', value: 'None' },
    ],
    priceFrom: '£33',
    related: ['laser-hair-removal', 'carbon-laser-peel', 'rf-lifting'],
    gradient: ['#7b6a5d', '#2a2420'],
  },
  {
    slug: 'carbon-laser-peel',
    category: 'aesthetics',
    group: 'Laser & Skin',
    title: 'Carbon Laser Peel',
    tagline: 'The red-carpet glow, on demand.',
    metaTitle: 'Carbon Laser Peel (Hollywood Facial) London | K Clinics',
    metaDescription:
      'The Carbon Laser Peel — a "Hollywood Facial" in Islington, London. Refine pores, clear congestion and reveal instant radiance with zero downtime at K Clinics.',
    keywords: ['carbon laser peel London', 'Hollywood facial', 'carbon facial', 'pore refining London'],
    eyebrow: 'Laser & Skin',
    intro:
      'A liquid carbon mask is drawn deep into the pores, then vaporised by laser light — lifting impurities, oil and dead cells while stimulating fresh collagen. The result is the famed "Hollywood" finish: tighter pores, an even tone and a luminous, photo-ready glow you can wear the same evening.',
    benefits: [
      { title: 'Instant radiance', text: 'Skin looks refined and luminous immediately — no downtime required.' },
      { title: 'Pore refinement', text: 'Deeply clears congestion and visibly minimises enlarged pores.' },
      { title: 'Oil & breakout control', text: 'Calms excess sebum and the conditions that drive breakouts.' },
      { title: 'Collagen kick', text: 'Gentle laser warmth stimulates fresh collagen for firmer texture.' },
    ],
    process: [
      { title: 'Carbon application', text: 'A fine carbon layer is applied and left to settle into the pores.' },
      { title: 'Laser pass', text: 'Laser light bonds to the carbon, vaporising impurities as it goes.' },
      { title: 'Reveal', text: 'Skin is instantly smoother, brighter and tightened — ready for anything.' },
    ],
    faqs: [
      { q: 'Is there any downtime?', a: 'None. The Carbon Laser Peel is a true "lunchtime" treatment — you can return to your day, or your evening, immediately.' },
      { q: 'How often should I have it?', a: 'A single treatment glows beautifully for an event; a short course every few weeks delivers cumulative refinement.' },
      { q: 'Is it suitable for oily, congested skin?', a: 'Ideally so — it is one of the most effective treatments for oil control and pore congestion.' },
    ],
    facts: [
      { label: 'Time', value: '30–45 min' },
      { label: 'Downtime', value: 'None' },
      { label: 'Glow', value: 'Immediate' },
    ],
    priceFrom: '£121',
    related: ['hydraglow-facial', 'face-treatments', 'laser-hair-removal'],
    gradient: ['#3d352f', '#a98a6d'],
  },
  {
    slug: 'laser-tattoo-removal',
    category: 'aesthetics',
    group: 'Laser & Skin',
    title: 'Laser Tattoo Removal',
    onRequest: true, // machine not in yet — page stays live, bookings closed (on request / coming soon)
    tagline: 'A clean slate, drawn with light.',
    metaTitle: 'Laser Tattoo Removal London (Islington) | K Clinics',
    metaDescription:
      'Advanced laser tattoo removal in Islington, London. Fade or fully remove unwanted ink safely across colours and skin tones at K Clinics. Free assessment.',
    keywords: ['laser tattoo removal London', 'tattoo removal Islington', 'Q-switched laser', 'tattoo fading'],
    eyebrow: 'Laser & Skin',
    intro:
      'Whether you are erasing a memory or clearing the canvas for new work, our laser shatters tattoo pigment into particles fine enough for the body to carry away — gradually, safely and with care taken at every pass to protect the surrounding skin.',
    benefits: [
      { title: 'All ink colours', text: 'Calibrated wavelengths address a broad spectrum of pigments.' },
      { title: 'Skin-first approach', text: 'Energy and cooling are managed to protect surrounding skin.' },
      { title: 'Full removal or fade', text: 'Erase completely, or fade for a confident cover-up.' },
      { title: 'Expert hands', text: 'Every session is delivered by trained, experienced clinicians.' },
    ],
    process: [
      { title: 'Assessment', text: 'We evaluate ink depth, colour and age to forecast your journey.' },
      { title: 'Staged sessions', text: 'Spaced to let the body clear pigment between treatments.' },
      { title: 'Gradual clearing', text: 'The tattoo fades progressively toward your goal.' },
    ],
    faqs: [
      { q: 'How many sessions does removal take?', a: 'It varies with size, colour, age and ink density — most tattoos need several sessions spaced six to eight weeks apart. We forecast your course at assessment.' },
      { q: 'Will it scar?', a: 'When performed correctly with appropriate aftercare, scarring is rare. We tailor settings specifically to protect your skin.' },
      { q: 'Can I fade rather than fully remove?', a: 'Yes — fading for a cover-up typically needs fewer sessions than complete removal.' },
    ],
    facts: [
      { label: 'Interval', value: '6–8 weeks' },
      { label: 'Approach', value: 'Fade or full removal' },
      { label: 'Consult', value: 'Complimentary' },
    ],
    priceFrom: '£44',
    related: ['carbon-laser-peel', 'face-treatments', 'laser-hair-removal'],
    gradient: ['#2a2420', '#7b6a5d'],
  },
  {
    slug: 'smas-hifu-lifting',
    category: 'aesthetics',
    group: 'Face & Lifting',
    title: 'SMAS HIFU Lifting',
    tagline: 'A lift from within — no scalpel, no downtime.',
    metaTitle: 'SMAS HIFU Face Lift London (Non-Surgical) | K Clinics',
    metaDescription:
      'Non-surgical HIFU face lift in Islington, London. Targeted ultrasound tightens the SMAS layer for a visibly lifted jaw, brow and neck at K Clinics. From £215.',
    keywords: ['HIFU London', 'SMAS lifting', 'non-surgical face lift London', 'ultrasound skin tightening'],
    eyebrow: 'Face & Lifting',
    intro:
      'High-Intensity Focused Ultrasound reaches the SMAS — the same deep support layer a surgeon addresses in a facelift — and delivers precise thermal energy that contracts and rebuilds collagen from within. The effect unfolds over weeks: a lifted jawline, a defined brow, a smoother neck. No surgery. No downtime.',
    benefits: [
      { title: 'Deep, structural lift', text: 'Targets the SMAS support layer for genuine lifting — not just surface tightening.' },
      { title: 'Jawline & neck', text: 'Beautifully redefines the jaw, jowl and neck contour.' },
      { title: 'Collagen renewal', text: 'Triggers months of natural collagen production for results that build.' },
      { title: 'Zero downtime', text: 'Return to life immediately — the lift reveals itself gradually.' },
    ],
    process: [
      { title: 'Mapping', text: 'We map treatment depths to your facial anatomy and goals.' },
      { title: 'Focused ultrasound', text: 'Energy is delivered to precise depths beneath the skin.' },
      { title: 'The gradual lift', text: 'Collagen rebuilds over 8–12 weeks, lifting and firming.' },
    ],
    faqs: [
      { q: 'When will I see results?', a: 'Some lift is visible early, but the full effect develops over eight to twelve weeks as new collagen forms, and continues to refine thereafter.' },
      { q: 'How long does it last?', a: 'Results typically last around a year. A maintenance session annually keeps the lift looking its best.' },
      { q: 'Is it painful?', a: 'You may feel brief warmth or tingling at depth. We adjust energy for your comfort throughout.' },
    ],
    facts: [
      { label: 'Results in', value: '8–12 weeks' },
      { label: 'Lasts', value: '~12 months' },
      { label: 'Downtime', value: 'None' },
    ],
    priceFrom: '£349',
    related: ['rf-lifting', 'cosmetic-injections', 'hydraglow-facial'],
    gradient: ['#a98a6d', '#2a2420'],
  },
  {
    slug: 'rf-lifting',
    category: 'aesthetics',
    group: 'Face & Lifting',
    title: 'RF Skin Tightening',
    menuTitle: 'RF Skin Tightening',
    tagline: 'Firm, sculpt, renew — wrapped in warmth.',
    metaTitle: 'Radiofrequency (RF) Skin Tightening London | K Clinics',
    metaDescription:
      'Radiofrequency skin tightening in Islington, London. Gently heats the dermis to firm, smooth and lift skin on face and body at K Clinics. From £175.',
    keywords: ['RF skin tightening London', 'radiofrequency facial', 'skin firming London', 'collagen induction'],
    eyebrow: 'Face & Lifting',
    intro:
      'Radiofrequency energy warms the deep dermis to a precise therapeutic temperature, contracting existing collagen on contact and prompting a fresh supply over the weeks that follow. The experience is famously relaxing — a deep, even warmth — while the outcome is firmer, smoother, visibly lifted skin.',
    benefits: [
      { title: 'Immediate tightening', text: 'Existing collagen contracts on contact for a firmer feel from day one.' },
      { title: 'Long-term firmness', text: 'New collagen builds over weeks for cumulative, lasting results.' },
      { title: 'Face & body', text: 'Refines the face, neck, and crepey skin across the body.' },
      { title: 'Deeply comfortable', text: 'A warm, spa-like treatment with no downtime whatsoever.' },
    ],
    process: [
      { title: 'Consultation', text: 'We define target zones and build your course.' },
      { title: 'Radiofrequency warming', text: 'Controlled heat is glided across the area to therapeutic depth.' },
      { title: 'Progressive firming', text: 'Skin continues to tighten as collagen renews.' },
    ],
    faqs: [
      { q: 'How many treatments are recommended?', a: 'A course of six, spaced one to two weeks apart, delivers the most striking and durable firming, often paired with HIFU.' },
      { q: 'Does it suit the body too?', a: 'Yes — RF is excellent for crepey skin on the neck, abdomen, arms and knees.' },
      { q: 'Is there recovery time?', a: 'None. Skin may look subtly flushed for a short while, then simply firmer.' },
    ],
    facts: [
      { label: 'Course', value: '6 sessions' },
      { label: 'Comfort', value: 'Warm & relaxing' },
      { label: 'Downtime', value: 'None' },
    ],
    priceFrom: '£260',
    related: ['smas-hifu-lifting', 'body-contouring', 'hydraglow-facial'],
    gradient: ['#c2a589', '#3d352f'],
  },
  {
    slug: 'hydraglow-facial',
    category: 'aesthetics',
    group: 'Face & Lifting',
    title: 'HydraGlow Facial',
    tagline: 'Cleanse, infuse, illuminate — in one breath.',
    metaTitle: 'HydraGlow Facial London (HydraFacial) | K Clinics',
    metaDescription:
      'The HydraGlow Facial in Islington, London. Cleanse, exfoliate, extract and infuse for instant hydration and luminous skin at K Clinics. From £79.',
    keywords: ['hydrafacial London', 'hydrating facial Islington', 'glow facial London', 'deep cleanse facial'],
    eyebrow: 'Face & Lifting',
    intro:
      'A multi-step ritual that cleanses, gently resurfaces, extracts and then floods the skin with serums of antioxidants, peptides and hyaluronic acid. Non-invasive and deeply restorative, the HydraGlow leaves skin plump, dewy and radiant — the perfect reset before an event, or a monthly indulgence that keeps skin in its best form.',
    benefits: [
      { title: 'Instant hydration', text: 'Skin drinks in serums for a plump, dewy, luminous finish.' },
      { title: 'Painless extraction', text: 'Gentle vortex suction clears congestion without the pinch.' },
      { title: 'Tailored serums', text: 'Boosters chosen for your concern — brightening, calming or firming.' },
      { title: 'Every skin type', text: 'Gentle enough for sensitive skin, effective for all.' },
    ],
    process: [
      { title: 'Cleanse & resurface', text: 'Lift away dead cells to reveal fresh skin beneath.' },
      { title: 'Extract & hydrate', text: 'Painless extraction paired with deep serum infusion.' },
      { title: 'Infuse & glow', text: 'Antioxidants and hyaluronic acid seal in the luminosity.' },
    ],
    faqs: [
      { q: 'How quickly will I see results?', a: 'Immediately. Skin looks hydrated, refined and radiant the moment you leave — with no downtime.' },
      { q: 'How often should I have one?', a: 'Monthly treatments keep skin in peak condition; many book one before a special occasion.' },
      { q: 'Can it be combined with other treatments?', a: 'Beautifully — it pairs with peels, microneedling and laser as part of a curated plan.' },
    ],
    facts: [
      { label: 'Time', value: '45–60 min' },
      { label: 'Downtime', value: 'None' },
      { label: 'Glow', value: 'Immediate' },
    ],
    priceFrom: '£110',
    related: ['carbon-laser-peel', 'face-treatments', 'cosmetic-injections'],
    gradient: ['#cdb4a3', '#c2a589'],
  },
  {
    slug: 'face-treatments',
    category: 'aesthetics',
    group: 'Face & Lifting',
    title: 'Signature Facials & Skin',
    menuTitle: 'Signature Facials',
    tagline: 'Peels, microneedling, PRP — the science of skin, curated.',
    metaTitle: 'Facials, Chemical Peels & Microneedling London | K Clinics',
    metaDescription:
      'Advanced facials in Islington, London: chemical peels, microneedling, PRP and skin resurfacing for acne, pigmentation, scarring and tone at K Clinics.',
    keywords: ['chemical peel London', 'microneedling London', 'PRP facial', 'skin resurfacing Islington'],
    eyebrow: 'Face & Lifting',
    intro:
      'Our advanced skin menu addresses what facials alone cannot: stubborn pigmentation, acne scarring, fine lines and uneven texture. From medical-grade chemical peels to collagen-inducing microneedling and regenerative PRP, each protocol is prescribed to your skin and layered into a plan that delivers visible, lasting change.',
    benefits: [
      { title: 'Chemical peels', text: 'Resurface to soften pigmentation, scarring and dullness.' },
      { title: 'Microneedling', text: 'Stimulate collagen to refine texture, pores and fine lines.' },
      { title: 'PRP therapy', text: "Harness your own platelets to regenerate and brighten." },
      { title: 'Prescriptive', text: 'Every treatment is chosen for your skin, never one-size-fits-all.' },
    ],
    process: [
      { title: 'Skin consultation', text: 'We analyse your skin and define a clear set of goals.' },
      { title: 'Layered protocol', text: 'Treatments are sequenced for compounding results.' },
      { title: 'Visible transformation', text: 'Tone, texture and clarity improve session on session.' },
    ],
    faqs: [
      { q: 'Which treatment is right for acne scarring?', a: 'Microneedling and certain peels are exceptional for scarring; we often combine them in a tailored course for the best outcome.' },
      { q: 'Is there downtime with peels?', a: 'It depends on depth — superficial peels have little to none, while deeper resurfacing may involve a few days of flaking. We advise precisely at consultation.' },
      { q: 'What is PRP?', a: 'Platelet-Rich Plasma uses growth factors drawn from a small sample of your own blood to regenerate and rejuvenate the skin.' },
    ],
    facts: [
      { label: 'Concerns', value: 'Acne · Pigment · Scars' },
      { label: 'Format', value: 'Prescriptive course' },
      { label: 'Consult', value: 'Complimentary' },
    ],
    priceFrom: '£115',
    related: ['hydraglow-facial', 'carbon-laser-peel', 'smas-hifu-lifting'],
    gradient: ['#7b6a5d', '#c2a589'],
  },
  {
    slug: 'body-contouring',
    category: 'aesthetics',
    group: 'Body & Injectables',
    title: 'Body Contouring',
    tagline: 'Sculpted, smoothed, defined — your shape, refined.',
    metaTitle: 'Body Contouring & Cellulite Treatment London | K Clinics',
    metaDescription:
      'Non-invasive body contouring in Islington, London. Endosphere, anti-cellulite vacuum therapy and RF to firm, smooth and define at K Clinics.',
    keywords: ['body contouring London', 'cellulite treatment Islington', 'endosphere', 'body sculpting London'],
    eyebrow: 'Body & Injectables',
    intro:
      'Harmonious, refined body contours without surgery or downtime. By combining compressive micro-vibration, anti-cellulite vacuum therapy and radiofrequency, we boost microcirculation, drain retained fluid and stimulate collagen — firming skin, smoothing cellulite and sculpting more defined contours.',
    benefits: [
      { title: 'Smooths cellulite', text: 'Targets the structure of cellulite for visibly smoother skin.' },
      { title: 'Firms & tightens', text: 'Collagen stimulation tightens lax skin across the body.' },
      { title: 'Drains & detoxifies', text: 'Improves lymphatic drainage and microcirculation.' },
      { title: 'Defines contours', text: 'Sculpts more harmonious shape across abdomen, thighs and arms.' },
    ],
    process: [
      { title: 'Body assessment', text: 'We define target zones and design your course.' },
      { title: 'Combination therapy', text: 'Micro-vibration, vacuum and RF layered per session.' },
      { title: 'Progressive sculpting', text: 'Skin firms and contours refine across the course.' },
    ],
    faqs: [
      { q: 'How many sessions deliver results?', a: 'A course of six to twelve, depending on the area and goal, gives the most defined and lasting result. Our BodyContour package pairs Endosphere with anti-cellulite therapy.' },
      { q: 'Is it comfortable?', a: 'Very — most clients describe it as a vigorous, warming massage with no downtime.' },
      { q: 'Will results last?', a: 'With a healthy lifestyle and occasional maintenance, results are long-lasting.' },
    ],
    facts: [
      { label: 'Course', value: '6–12 sessions' },
      { label: 'Downtime', value: 'None' },
      { label: 'Areas', value: 'Abdomen · Thighs · Arms' },
    ],
    priceFrom: '£95',
    related: ['rf-lifting', 'smas-hifu-lifting', 'cosmetic-injections'],
    gradient: ['#c2a589', '#7b6a5d'],
  },
  {
    slug: 'cosmetic-injections',
    category: 'aesthetics',
    group: 'Body & Injectables',
    title: 'Cosmetic Injectables',
    menuTitle: 'Cosmetic Injections',
    tagline: 'Refined, never reinvented. The art of looking like you.',
    metaTitle: 'Anti-Wrinkle & Dermal Filler Injections London | K Clinics',
    metaDescription:
      'Expert cosmetic injectables in Islington, London — anti-wrinkle treatment, dermal filler and fat-dissolving — delivered with a natural, refined aesthetic at K Clinics.',
    keywords: ['Botox London', 'dermal filler London', 'anti-wrinkle injections Islington', 'lip filler London'],
    eyebrow: 'Body & Injectables',
    intro:
      'Injectables, done with restraint and artistry. Anti-wrinkle treatment softens the lines of expression; dermal filler restores volume and sculpts subtle definition; targeted fat-dissolving refines the profile. Our clinicians work to a single principle — enhancing your features so the result is simply a rested, refreshed version of you.',
    benefits: [
      { title: 'Anti-wrinkle', text: 'Relaxes the muscles that etch frown lines, forehead lines and crow’s feet.' },
      { title: 'Dermal filler', text: 'Restores lost volume and sculpts cheeks, lips and jawline.' },
      { title: 'Profile refinement', text: 'Fat-dissolving treatment to soften a double chin.' },
      { title: 'Natural results', text: 'An artistic, conservative approach — refreshed, never frozen.' },
    ],
    process: [
      { title: 'Consultation', text: 'We assess facial dynamics and agree a natural, tailored plan.' },
      { title: 'Precise treatment', text: 'Product is placed with anatomical precision and care.' },
      { title: 'Refined result', text: 'Results settle over days into a soft, natural enhancement.' },
    ],
    faqs: [
      { q: 'Will I look natural?', a: 'That is our signature. We treat conservatively and artistically so you look like a refreshed version of yourself.' },
      { q: 'How long do results last?', a: 'Anti-wrinkle results typically last three to four months; dermal fillers six to eighteen months depending on the product and area.' },
      { q: 'Is it painful?', a: 'Discomfort is minimal. We use fine needles and, where appropriate, products containing anaesthetic for comfort.' },
    ],
    facts: [
      { label: 'Anti-wrinkle', value: '~3–4 months' },
      { label: 'Filler', value: '6–18 months' },
      { label: 'Downtime', value: 'Minimal' },
    ],
    priceFrom: '£150',
    related: ['smas-hifu-lifting', 'hydraglow-facial', 'face-treatments'],
    gradient: ['#cdb4a3', '#a98a6d'],
  },
  {
    slug: 'intimate-rejuvenation',
    category: 'aesthetics',
    group: 'Body & Injectables',
    title: 'Intimate Rejuvenation',
    audience: 'female',
    tagline: 'Confidence, restored — with discretion and care.',
    metaTitle: 'Intimate Rejuvenation & Whitening London | K Clinics',
    metaDescription:
      'Advanced intimate rejuvenation in Islington, London — CO2 laser tightening and intimate whitening, delivered with absolute discretion and expert care at K Clinics.',
    keywords: ['intimate rejuvenation London', 'CO2 laser intimate', 'intimate whitening London', 'feminine wellness'],
    eyebrow: 'Body & Injectables',
    intro:
      'Sensitive concerns deserve sensitive expertise. Using fractional CO2 laser technology, our intimate rejuvenation gently stimulates collagen to restore tone and comfort, while intimate whitening evens pigmentation — all delivered privately, by clinicians who prioritise your dignity at every step.',
    benefits: [
      { title: 'Restores tone', text: 'CO2 laser stimulates collagen to firm and revitalise tissue.' },
      { title: 'Evens pigment', text: 'Gentle whitening protocols address intimate-area pigmentation.' },
      { title: 'Comfort & confidence', text: 'Improves comfort, dryness and intimate wellbeing.' },
      { title: 'Absolute discretion', text: 'A private, respectful experience from consultation onward.' },
    ],
    process: [
      { title: 'Private consultation', text: 'A confidential discussion of your goals and suitability.' },
      { title: 'Gentle treatment', text: 'Comfortable, precise sessions tailored to you.' },
      { title: 'Renewed confidence', text: 'Tone and tone-evenness improve over the course.' },
    ],
    faqs: [
      { q: 'Is the treatment comfortable?', a: 'Yes. Treatments are gentle and well-tolerated, with comfort measures used as needed and minimal downtime.' },
      { q: 'How many sessions are required?', a: 'A short course is usually recommended; we advise precisely after a private consultation.' },
      { q: 'Is it confidential?', a: 'Completely. Discretion and dignity are central to how we deliver this treatment.' },
    ],
    facts: [
      { label: 'Technology', value: 'Fractional CO2' },
      { label: 'Discretion', value: 'Absolute' },
      { label: 'Downtime', value: 'Minimal' },
    ],
    priceFrom: 'On consultation',
    related: ['rf-lifting', 'body-contouring', 'face-treatments'],
    gradient: ['#cdb4a3', '#3d352f'],
  },

  // ───────────────────────────── DENTISTRY ──────────────────────────────────
  {
    slug: 'veneers',
    category: 'dentistry',
    group: 'Aesthetic Dentistry',
    title: 'Porcelain Veneers',
    tagline: 'A smile, designed. Hand-crafted in fine ceramic.',
    metaTitle: 'Porcelain Veneers London (Islington) | K Clinics',
    metaDescription:
      'Bespoke porcelain veneers in Islington, London. Hand-crafted ceramic veneers to perfect shape, shade and symmetry for a natural, luminous smile at K Clinics.',
    keywords: ['porcelain veneers London', 'veneers Islington', 'smile makeover London', 'composite vs porcelain veneers'],
    eyebrow: 'Aesthetic Dentistry',
    intro:
      'Wafer-thin shells of high-grade ceramic, individually crafted and bonded to the front of the teeth to correct shape, shade, spacing and symmetry. Veneers conceal chips, discolouration and irregularity behind a surface that catches light exactly as natural enamel does — for a smile that is transformed, yet unmistakably yours.',
    benefits: [
      { title: 'Natural translucency', text: 'Fine ceramic mimics the way real enamel reflects light.' },
      { title: 'Corrects multiple flaws', text: 'Chips, gaps, discolouration and shape in one solution.' },
      { title: 'Stain-resistant', text: 'Porcelain resists the staining that affects natural teeth.' },
      { title: 'Long-lasting', text: 'With care, well-made veneers last many years.' },
    ],
    process: [
      { title: 'Smile design', text: 'We plan shape, shade and proportion to suit your face.' },
      { title: 'Preparation & preview', text: 'Minimal preparation and a preview of your new smile.' },
      { title: 'Bonding', text: 'Hand-finished veneers are precisely bonded into place.' },
    ],
    faqs: [
      { q: 'Will my veneers look natural?', a: 'Yes — we design shape, proportion and shade to your face, and use ceramics that mimic natural translucency, so the result looks beautifully real.' },
      { q: 'How long do veneers last?', a: 'With good care and regular check-ups, quality porcelain veneers commonly last ten to fifteen years or more.' },
      { q: 'Veneers or composite bonding?', a: 'Porcelain offers superior longevity and lustre; composite is more economical and reversible. We advise the best fit at consultation.' },
    ],
    facts: [
      { label: 'Material', value: 'Fine ceramic' },
      { label: 'Lasts', value: '10–15+ years' },
      { label: 'Visits', value: '2–3' },
    ],
    priceFrom: 'On consultation',
    related: ['composite-bonding', 'teeth-whitening', 'aesthetic-dentistry'],
    gradient: ['#dcc4a8', '#7b6a5d'],
  },
  {
    slug: 'teeth-whitening',
    category: 'dentistry',
    group: 'Aesthetic Dentistry',
    title: 'Teeth Whitening',
    tagline: 'Brighter, lighter, luminous — safely.',
    metaTitle: 'Professional Teeth Whitening London | K Clinics',
    metaDescription:
      'Professional teeth whitening in Islington, London. In-clinic power whitening and bespoke at-home kits for a brighter, natural-looking smile at K Clinics.',
    keywords: ['teeth whitening London', 'professional whitening Islington', 'in-clinic whitening', 'home whitening kit'],
    eyebrow: 'Aesthetic Dentistry',
    intro:
      'A brighter smile, achieved safely and predictably under clinical supervision. Choose accelerated in-clinic whitening for instant results, or a bespoke at-home system with custom-fitted trays — or combine both. We protect your gums and enamel throughout, for a whiter shade that looks natural, never artificial.',
    benefits: [
      { title: 'In-clinic power', text: 'Advanced gels and light for a brighter shade in a single visit.' },
      { title: 'At-home precision', text: 'Custom trays and professional gel to whiten on your schedule.' },
      { title: 'Enamel-safe', text: 'Clinically supervised to protect gums and enamel.' },
      { title: 'Natural finish', text: 'A brighter shade that still looks authentically yours.' },
    ],
    process: [
      { title: 'Assessment', text: 'We check suitability and record your starting shade.' },
      { title: 'Whitening', text: 'In-clinic session and/or fitting of bespoke home trays.' },
      { title: 'Bright reveal', text: 'Enjoy a noticeably brighter, even smile.' },
    ],
    faqs: [
      { q: 'Is professional whitening safe?', a: 'Yes — performed by dental professionals with protective measures for your gums and enamel, it is safe and far more effective than over-the-counter options.' },
      { q: 'In-clinic or at-home?', a: 'In-clinic gives instant results; at-home offers gradual control. Many choose both for the best, longest-lasting outcome.' },
      { q: 'Will it cause sensitivity?', a: 'Some temporary sensitivity is normal and settles quickly; we use formulations and techniques that minimise it.' },
    ],
    facts: [
      { label: 'In-clinic', value: '~60–90 min' },
      { label: 'At-home', value: 'Bespoke trays' },
      { label: 'Result', value: 'Brighter shade' },
    ],
    priceFrom: 'On consultation',
    related: ['veneers', 'composite-bonding', 'aesthetic-dentistry'],
    gradient: ['#f6ece3', '#c2a589'],
  },
  {
    slug: 'composite-bonding',
    category: 'dentistry',
    group: 'Aesthetic Dentistry',
    title: 'Composite Bonding',
    tagline: 'Reshape, repair, perfect — in a single visit.',
    metaTitle: 'Composite Bonding London (Islington) | K Clinics',
    metaDescription:
      'Composite bonding in Islington, London. Reshape chips, close gaps and refine your smile in a single visit with minimal preparation at K Clinics.',
    keywords: ['composite bonding London', 'edge bonding Islington', 'tooth bonding', 'gap closing London'],
    eyebrow: 'Aesthetic Dentistry',
    intro:
      'Tooth-coloured composite, sculpted directly onto the teeth and polished to a natural lustre — a minimally invasive way to repair chips, close small gaps, reshape edges and refine proportion. Often completed in a single visit, with little or no preparation of the natural tooth.',
    benefits: [
      { title: 'Single visit', text: 'Most cases are completed beautifully in one appointment.' },
      { title: 'Minimally invasive', text: 'Little to no natural tooth structure is removed.' },
      { title: 'Versatile', text: 'Repairs chips, closes gaps and reshapes edges.' },
      { title: 'Natural shade', text: 'Composite is matched and polished to blend seamlessly.' },
    ],
    process: [
      { title: 'Design', text: 'We plan shape and shade to complement your smile.' },
      { title: 'Sculpting', text: 'Composite is layered, shaped and cured directly on the tooth.' },
      { title: 'Polish', text: 'A final polish brings a natural, light-catching finish.' },
    ],
    faqs: [
      { q: 'How long does bonding last?', a: 'With good care, composite bonding typically lasts four to eight years before a refresh. It can chip, but is easily repaired.' },
      { q: 'Is it reversible?', a: 'Largely, yes — because little or no natural tooth is removed, bonding is among the most conservative cosmetic options.' },
      { q: 'Can it close gaps?', a: 'Yes — bonding is excellent for closing small gaps and reshaping uneven edges.' },
    ],
    facts: [
      { label: 'Visit', value: 'Often single' },
      { label: 'Lasts', value: '4–8 years' },
      { label: 'Prep', value: 'Minimal' },
    ],
    priceFrom: 'On consultation',
    related: ['veneers', 'teeth-whitening', 'aesthetic-dentistry'],
    gradient: ['#c2a589', '#f6ece3'],
  },
  {
    slug: 'aesthetic-dentistry',
    category: 'dentistry',
    group: 'Aesthetic Dentistry',
    title: 'Aesthetic Dentistry',
    tagline: 'Where dental health and beauty become one.',
    metaTitle: 'Aesthetic & Cosmetic Dentistry London | K Clinics',
    metaDescription:
      'Aesthetic dentistry in Islington, London. Smile design uniting veneers, whitening, bonding, straightening and implants for a healthy, beautiful smile at K Clinics.',
    keywords: ['aesthetic dentistry London', 'cosmetic dentistry Islington', 'smile makeover London', 'smile design'],
    eyebrow: 'Aesthetic Dentistry',
    intro:
      'Aesthetic dentistry unites function and beauty — a considered approach to designing a smile that is healthy, balanced and quietly confident. We bring together veneers, whitening, bonding, straightening and implants under one plan, calibrated to your features, your bite and your goals.',
    benefits: [
      { title: 'Complete smile design', text: 'A holistic plan across whitening, veneers, bonding and alignment.' },
      { title: 'Health-led beauty', text: 'Aesthetics built on a foundation of dental health and function.' },
      { title: 'Bespoke to you', text: 'Designed around your face, your bite and your goals.' },
      { title: 'Expert artistry', text: 'Delivered by clinicians with a meticulous eye for detail.' },
    ],
    process: [
      { title: 'Consultation', text: 'We assess your smile and discuss your aspirations.' },
      { title: 'Smile design plan', text: 'A staged, costed plan combining the right treatments.' },
      { title: 'Transformation', text: 'Your new smile is realised, step by considered step.' },
    ],
    faqs: [
      { q: 'Where do I start?', a: 'With a consultation. We assess your smile and health, then design a clear, staged plan that fits your goals and budget.' },
      { q: 'Can you combine treatments?', a: 'Yes — most smile makeovers thoughtfully combine whitening, bonding or veneers, and sometimes alignment, for a harmonious result.' },
      { q: 'Will it look natural?', a: 'Absolutely. Our entire philosophy is natural-looking enhancement designed around your individual features.' },
    ],
    facts: [
      { label: 'Approach', value: 'Smile design' },
      { label: 'Combines', value: 'Veneers · Whitening · More' },
      { label: 'Consult', value: 'Complimentary' },
    ],
    priceFrom: 'On consultation',
    related: ['veneers', 'teeth-whitening', 'composite-bonding'],
    gradient: ['#7b6a5d', '#dcc4a8'],
  },
  {
    slug: 'dental-implant-placement',
    category: 'dentistry',
    group: 'Restorative & Specialist',
    title: 'Dental Implants',
    menuTitle: 'Dental Implant Placement',
    tagline: 'A permanent foundation for a confident smile.',
    metaTitle: 'Dental Implants London (Islington) | K Clinics',
    metaDescription:
      'Dental implants in Islington, London. Titanium implants to replace missing teeth permanently — secure, natural-looking and built to last at K Clinics.',
    keywords: ['dental implants London', 'tooth implant Islington', 'single tooth implant', 'implant dentist London'],
    eyebrow: 'Restorative & Specialist',
    intro:
      'A dental implant replaces a missing tooth at the root. A biocompatible titanium post is precisely placed into the jawbone, where it fuses to become a stable foundation; a custom crown, bridge or denture is then secured on top. The result looks, feels and functions like a natural tooth — and protects the bone and bite for the long term.',
    benefits: [
      { title: 'Permanent solution', text: 'A fixed, long-term replacement — not a temporary fix.' },
      { title: 'Looks & feels natural', text: 'Custom restorations matched to your natural teeth.' },
      { title: 'Protects the jaw', text: 'Stimulates bone, preventing the loss that follows missing teeth.' },
      { title: 'Restores function', text: 'Eat, speak and smile with complete confidence.' },
    ],
    process: [
      { title: 'Assessment & planning', text: 'Imaging and planning to place the implant with precision.' },
      { title: 'Implant placement', text: 'The titanium post is gently placed and left to integrate.' },
      { title: 'Crown & restore', text: 'A bespoke crown, bridge or denture completes your smile.' },
    ],
    faqs: [
      { q: 'How long does the process take?', a: 'After placement, the implant integrates with the bone over a few months before the final restoration is fitted — ensuring a strong, lasting result.' },
      { q: 'Are implants painful?', a: 'Placement is carried out under local anaesthetic and most patients report far less discomfort than expected, with simple aftercare.' },
      { q: 'How long do implants last?', a: 'With good oral hygiene and regular check-ups, implants can last for decades — often a lifetime.' },
    ],
    facts: [
      { label: 'Material', value: 'Titanium' },
      { label: 'Integration', value: '~3–6 months' },
      { label: 'Lifespan', value: 'Decades' },
    ],
    priceFrom: 'On consultation',
    related: ['dentures', 'specialist-dentistry', 'dental-consultations'],
    gradient: ['#3d352f', '#c2a589'],
  },
  {
    slug: 'dentures',
    category: 'dentistry',
    group: 'Restorative & Specialist',
    title: 'Dentures & Implant Dentures',
    menuTitle: 'Dentures',
    tagline: 'Comfort, function and a natural smile — restored.',
    metaTitle: 'Dentures & Implant-Supported Dentures London | K Clinics',
    metaDescription:
      'Bespoke dentures and implant-supported dentures in Islington, London. Comfortable, secure, natural-looking tooth replacement at K Clinics.',
    keywords: ['dentures London', 'implant supported dentures', 'denture clinic Islington', 'All-on-4 London'],
    eyebrow: 'Restorative & Specialist',
    intro:
      'Modern dentures bear little resemblance to those of the past. Crafted for a precise, comfortable fit and a natural appearance, they restore your smile and function — and, when anchored to implants, deliver remarkable stability for confident eating and speaking, without slipping.',
    benefits: [
      { title: 'Natural appearance', text: 'Crafted to look and sit naturally with your features.' },
      { title: 'Implant-secured option', text: 'Anchored to implants for stability that won’t slip.' },
      { title: 'Comfortable fit', text: 'Precisely made for comfort and confident function.' },
      { title: 'Restored confidence', text: 'Eat and speak freely, and smile without hesitation.' },
    ],
    process: [
      { title: 'Consultation', text: 'We assess your needs and recommend the right solution.' },
      { title: 'Bespoke crafting', text: 'Dentures are made to fit your mouth precisely.' },
      { title: 'Fit & refine', text: 'We fit, adjust and perfect your comfort.' },
    ],
    faqs: [
      { q: 'What are implant-supported dentures?', a: 'They clip securely onto dental implants, giving far greater stability than conventional dentures — ideal if you want a denture that stays firmly in place.' },
      { q: 'Will they look natural?', a: 'Yes — modern dentures are crafted to match your features for a natural, confident smile.' },
      { q: 'How do I care for them?', a: 'We provide simple, clear aftercare guidance to keep your dentures comfortable, clean and long-lasting.' },
    ],
    facts: [
      { label: 'Options', value: 'Full · Partial · Implant' },
      { label: 'Fit', value: 'Bespoke' },
      { label: 'Stability', value: 'Implant-secured' },
    ],
    priceFrom: 'On consultation',
    related: ['dental-implant-placement', 'specialist-dentistry', 'dental-consultations'],
    gradient: ['#91766e', '#f6ece3'],
  },
  {
    slug: 'specialist-dentistry',
    category: 'dentistry',
    group: 'Restorative & Specialist',
    title: 'Specialist Dentistry',
    tagline: 'Complex care, in considered hands.',
    metaTitle: 'Specialist Dentistry London (Islington) | K Clinics',
    metaDescription:
      'Specialist dental care in Islington, London — advanced restorative, endodontic and complex treatment planning delivered with precision at K Clinics.',
    keywords: ['specialist dentist London', 'root canal Islington', 'restorative dentistry London', 'complex dental care'],
    eyebrow: 'Restorative & Specialist',
    intro:
      'For more complex needs, our specialist-led care brings advanced expertise and meticulous planning to every case — from root canal therapy and advanced restoration to the careful sequencing of multi-stage treatment. Thorough, gentle and built around your comfort.',
    benefits: [
      { title: 'Advanced expertise', text: 'Specialist-led care for complex and demanding cases.' },
      { title: 'Meticulous planning', text: 'Careful diagnosis and staged, predictable treatment.' },
      { title: 'Gentle delivery', text: 'Comfort-focused techniques throughout your care.' },
      { title: 'Restorative excellence', text: 'Function and aesthetics restored to a high standard.' },
    ],
    process: [
      { title: 'Diagnosis', text: 'Thorough assessment and imaging to understand your case.' },
      { title: 'Treatment plan', text: 'A clear, staged plan tailored to your needs.' },
      { title: 'Expert care', text: 'Treatment delivered with precision and gentleness.' },
    ],
    faqs: [
      { q: 'What does specialist dentistry cover?', a: 'It spans complex restorative work, endodontics (root canal therapy), advanced planning and the coordination of multi-stage care — anything beyond routine treatment.' },
      { q: 'Will treatment be comfortable?', a: 'Yes — we prioritise gentle, comfort-focused techniques and clear communication at every stage.' },
      { q: 'Do I need a referral?', a: 'Not necessarily — book a consultation and we will assess your needs and advise the right pathway.' },
    ],
    facts: [
      { label: 'Scope', value: 'Complex care' },
      { label: 'Approach', value: 'Specialist-led' },
      { label: 'Planning', value: 'Meticulous' },
    ],
    priceFrom: 'On consultation',
    related: ['dental-implant-placement', 'dentures', 'dental-consultations'],
    gradient: ['#7b6a5d', '#2a2420'],
  },
  {
    slug: 'dental-consultations',
    category: 'dentistry',
    group: 'Restorative & Specialist',
    title: 'Dental Consultations',
    tagline: 'Every great smile begins with a conversation.',
    metaTitle: 'Dental Consultation London (Islington) | K Clinics',
    metaDescription:
      'Book a dental consultation in Islington, London. A thorough assessment and a clear, personalised treatment plan for your smile at K Clinics.',
    keywords: ['dental consultation London', 'dentist Islington', 'smile assessment', 'treatment plan dentist'],
    eyebrow: 'Restorative & Specialist',
    intro:
      'The starting point for everything we do. Your consultation is an unhurried, thorough assessment of your oral health and your goals — followed by a clear, personalised plan that sets out your options, the journey and the investment, with no pressure and complete transparency.',
    benefits: [
      { title: 'Thorough assessment', text: 'A careful review of your oral health and smile.' },
      { title: 'Clear plan', text: 'Personalised options, staging and transparent costs.' },
      { title: 'No pressure', text: 'Honest advice and the space to make your decision.' },
      { title: 'Your goals first', text: 'A plan built entirely around what you want to achieve.' },
    ],
    process: [
      { title: 'Discussion', text: 'We listen to your concerns and aspirations.' },
      { title: 'Examination', text: 'A thorough clinical assessment, with imaging if needed.' },
      { title: 'Your plan', text: 'A clear, written plan you can take away.' },
    ],
    faqs: [
      { q: 'What happens at a consultation?', a: 'We discuss your goals, examine your teeth and gums, take any necessary images, and then present a clear, personalised treatment plan.' },
      { q: 'Is there any obligation?', a: 'None at all. Our role is to inform and advise; the decision, and the pace, are always yours.' },
      { q: 'New clients get a discount?', a: 'New clients enjoy 15% off their first visit — for dental or aesthetic treatment. Ask us when you book.' },
    ],
    facts: [
      { label: 'Duration', value: 'Unhurried' },
      { label: 'Outcome', value: 'Personalised plan' },
      { label: 'New clients', value: '15% off first visit' },
    ],
    priceFrom: 'On consultation',
    related: ['aesthetic-dentistry', 'dental-implant-placement', 'veneers'],
    gradient: ['#c2a589', '#7b6a5d'],
  },
  // Treatments imported from the existing kclinics.co.uk site (real copy).
  ...importedTreatments,
];

// ── Booking config ───────────────────────────────────────────────────────────
// Price (pence) + duration (minutes) per treatment, used by the booking system.
// price `null` ⇒ "on consultation": booked as a £0 card-on-file hold, with the
// amount set by staff at charge time. Edit these freely — they are guide values.
type BookingCfg = { pricePence: number | null; durationMin: number; bufferMin?: number; requiresResource?: string };
export const bookingConfig: Record<string, BookingCfg> = {
  // "from" = lowest single-session price from the official price sheet.
  'laser-hair-removal':          { pricePence: 1100,  durationMin: 15, bufferMin: 10, requiresResource: 'laser' },  // eyebrows from £11
  'laser-hair-removal-for-men':  { pricePence: 3300,  durationMin: 15, bufferMin: 10, requiresResource: 'laser' },  // underarms from £33
  'carbon-laser-peel':           { pricePence: 12100, durationMin: 40, bufferMin: 10, requiresResource: 'laser' },  // Hollywood peel full face from £121
  'laser-tattoo-removal':        { pricePence: 4400,  durationMin: 15, bufferMin: 10, requiresResource: 'laser' },  // very small from £44
  'smas-hifu-lifting':           { pricePence: 34900, durationMin: 30, bufferMin: 10, requiresResource: 'hifu' },  // eyebrow/forehead/neck lift from £349
  'rf-lifting':                  { pricePence: 26000, durationMin: 45, bufferMin: 10 },  // from £260
  'hydraglow-facial':            { pricePence: 9500,  durationMin: 30, bufferMin: 10 },  // signature express from £95
  'face-treatments':            { pricePence: 11500, durationMin: 30, bufferMin: 10 },  // cosmetic peel full face from £115
  'body-contouring':             { pricePence: 11000, durationMin: 60, bufferMin: 15 },  // Endosphere from £110
  'cosmetic-injections':         { pricePence: 15000, durationMin: 30, bufferMin: 10 },  // fat-dissolving from £150/vial
  'intimate-rejuvenation':       { pricePence: 69000, durationMin: 40, bufferMin: 15, requiresResource: 'laser' },  // CO2 laser from £690
  'veneers':                     { pricePence: null,  durationMin: 60 },
  'teeth-whitening':             { pricePence: null,  durationMin: 60 },
  'composite-bonding':           { pricePence: null,  durationMin: 60 },
  'aesthetic-dentistry':         { pricePence: null,  durationMin: 45 },
  'dental-implant-placement':    { pricePence: null,  durationMin: 60 },
  'dentures':                    { pricePence: null,  durationMin: 45 },
  'specialist-dentistry':        { pricePence: null,  durationMin: 45 },
  'dental-consultations':        { pricePence: null,  durationMin: 30 },
  // Imported treatments — prices from the official price sheet where known.
  'laser-skin-rejuvenation':     { pricePence: 21000, durationMin: 25, bufferMin: 10, requiresResource: 'laser' },  // Face & Neck from £210
  'pigmentation-correction':     { pricePence: 1800,  durationMin: 20, bufferMin: 10, requiresResource: 'laser' },  // nose from £18
  'vascular-lesions-treatment':  { pricePence: 1800,  durationMin: 20, bufferMin: 10, requiresResource: 'laser' },  // single vein from £18
  'scar-stretch-mark-reduction': { pricePence: null,  durationMin: 45, bufferMin: 10 },
  'spider-veins-removal':        { pricePence: 23000, durationMin: 25, bufferMin: 10, requiresResource: 'laser' },  // nose thread vein from £230
  'laser-skin-resurfacing':      { pricePence: 18000, durationMin: 45, bufferMin: 10, requiresResource: 'laser' },  // from £180
  'ipl-phototherapy':            { pricePence: 20000, durationMin: 45, bufferMin: 10, requiresResource: 'laser' },  // from £200
  'fungal-nail-infection-treatment': { pricePence: 7900, durationMin: 30 }, // 1 foot from £79
  'permanent-makeup-removal':    { pricePence: 27500, durationMin: 30 },  // eyebrows from £275
  'microneedling':               { pricePence: null,  durationMin: 60 },
  'prp-therapy':                 { pricePence: null,  durationMin: 60 },
  'chemical-peels':              { pricePence: 11500, durationMin: 30 },  // cosmetic peel full face from £115
  'microdermabrasion':           { pricePence: null,  durationMin: 45 },
  'botox':                       { pricePence: null,  durationMin: 30 },
  'dermal-fillers':              { pricePence: null,  durationMin: 45 },
  'kybella':                     { pricePence: null,  durationMin: 45 },
  'anti-cellulite-programs':     { pricePence: 11000, durationMin: 60 },  // Endosphere from £110
  'vacuum-massage':              { pricePence: null,  durationMin: 50 },
  'hip-dip-filler':              { pricePence: null,  durationMin: 45 },
  'body-hifu-lifting':           { pricePence: 30900, durationMin: 60 },  // body HIFU from £309
  'intimate-area-whitening':     { pricePence: 69000, durationMin: 40 },  // from £690
};

export function bookingFor(slug: string): BookingCfg {
  return bookingConfig[slug] ?? { pricePence: null, durationMin: 45 };
}

/** Treatments with a fixed price (bookable with an upfront amount shown). */
export const bookableTreatments = treatments.map((t) => ({ ...t, ...bookingFor(t.slug) }));

export const formatPrice = (pence: number | null | undefined) =>
  pence == null ? 'On consultation' : `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: pence % 100 ? 2 : 0 })}`;

// ── Helpers ──────────────────────────────────────────────────────────────────
export const getTreatment = (slug: string) => treatments.find((t) => t.slug === slug);
export const treatmentSlugs = treatments.map((t) => t.slug);
export const aesthetics = treatments.filter((t) => t.category === 'aesthetics');
export const dentistry = treatments.filter((t) => t.category === 'dentistry');

export const groupByGroup = (list: Treatment[]) =>
  list.reduce<Record<string, Treatment[]>>((acc, t) => {
    (acc[t.group] ||= []).push(t);
    return acc;
  }, {});
