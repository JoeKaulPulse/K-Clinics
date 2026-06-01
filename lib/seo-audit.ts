import 'server-only';
import { db } from '@/lib/db';
import { treatments } from '@/lib/treatments';

// ── SEO / GEO / agentic audit engine ────────────────────────────────────────
// Self-contained rules-based scoring. Each page is rated across four lenses —
// on-page, technical/structured-data, generative (AI-answer) readiness and
// local/GEO — producing per-category scores, an overall grade, a list of
// actionable issues, and a site-wide health score. Per-path overrides from the
// PageSeo table are merged over code defaults before scoring.

export type Severity = 'high' | 'med' | 'low';
export type Issue = { category: Category; severity: Severity; message: string };
export type Category = 'onpage' | 'technical' | 'generative' | 'local';

export type PageInput = {
  path: string;
  title: string;
  description: string;
  keywords: string[];
  focusKeyword?: string | null;
  type: 'home' | 'treatment' | 'hub' | 'commerce' | 'content' | 'contact' | 'academy';
  hasSchema: boolean;   // emits JSON-LD (Service/Org/etc.)
  hasFaq: boolean;      // emits FAQ Q&A (answer-engine friendly)
  ogImage: boolean;
  noindex: boolean;
  overridden: boolean;  // has a PageSeo override row
};

export type PageScore = {
  path: string; title: string; description: string; focusKeyword: string | null; type: string; overridden: boolean;
  onpage: number; technical: number; generative: number; local: number; overall: number; grade: string;
  issues: Issue[];
};

const LOCAL_RE = /\b(london|islington|n1\b|angel|near me|uk)\b/i;
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
export const grade = (s: number) => (s >= 90 ? 'A' : s >= 80 ? 'B' : s >= 70 ? 'C' : s >= 55 ? 'D' : 'F');

function scorePage(p: PageInput): PageScore {
  const issues: Issue[] = [];
  const add = (category: Category, severity: Severity, message: string) => issues.push({ category, severity, message });
  const kw = (p.focusKeyword || p.keywords[0] || '').toLowerCase();
  const titleL = p.title.trim().length;
  const descL = p.description.trim().length;

  // ── On-page ──
  let onpage = 100;
  if (!p.title.trim()) { onpage -= 45; add('onpage', 'high', 'Missing page title.'); }
  else if (titleL < 30) { onpage -= 15; add('onpage', 'med', `Title is short (${titleL} chars) — aim for 30–60.`); }
  else if (titleL > 65) { onpage -= 12; add('onpage', 'med', `Title is long (${titleL} chars) — it may truncate in results.`); }
  if (!p.description.trim()) { onpage -= 40; add('onpage', 'high', 'Missing meta description.'); }
  else if (descL < 70) { onpage -= 15; add('onpage', 'med', `Meta description is short (${descL} chars) — aim for 70–160.`); }
  else if (descL > 165) { onpage -= 12; add('onpage', 'low', `Meta description is long (${descL} chars) — it may truncate.`); }
  if (kw && !p.title.toLowerCase().includes(kw)) { onpage -= 12; add('onpage', 'med', `Focus keyword “${kw}” isn’t in the title.`); }
  if (kw && !p.description.toLowerCase().includes(kw)) { onpage -= 8; add('onpage', 'low', `Focus keyword “${kw}” isn’t in the description.`); }
  if (p.keywords.length === 0) { onpage -= 8; add('onpage', 'low', 'No target keywords set.'); }

  // ── Technical & structured data ──
  let technical = 100;
  if (p.noindex) { technical -= 60; add('technical', 'high', 'Page is set to noindex — it won’t rank.'); }
  if (!p.hasSchema) { technical -= 30; add('technical', 'med', 'No structured data (JSON-LD) detected — add Service/Article/Breadcrumb schema.'); }
  if (!p.ogImage) { technical -= 15; add('technical', 'low', 'No Open Graph image — links won’t preview well when shared.'); }

  // ── Generative / agentic readiness ──
  let generative = 100;
  if (!p.hasFaq) { generative -= 30; add('generative', 'med', 'No FAQ/Q&A blocks — AI answer engines favour clear question-and-answer content.'); }
  if (!p.hasSchema) { generative -= 20; add('generative', 'med', 'No entity schema — assistants rely on structured entities to cite you.'); }
  if (descL > 165 || descL < 50) { generative -= 12; add('generative', 'low', 'Lead description isn’t answer-first — open with a concise, quotable summary.'); }
  if (!kw) { generative -= 10; add('generative', 'low', 'No clear topic/keyword — weakens topical clarity for AI retrieval.'); }

  // ── Local / GEO ──
  let local = 100;
  const localHay = `${p.title} ${p.description} ${p.keywords.join(' ')}`;
  if (!LOCAL_RE.test(localHay)) { local -= 40; add('local', 'med', 'No local signal (London/Islington) — add it for local search & map intent.'); }
  if ((p.type === 'home' || p.type === 'contact') && !p.hasSchema) { local -= 30; add('local', 'high', 'Key local page is missing LocalBusiness schema.'); }

  const oc = clamp(onpage), tc = clamp(technical), gc = clamp(generative), lc = clamp(local);
  const overall = clamp(oc * 0.35 + tc * 0.25 + gc * 0.25 + lc * 0.15);
  return { path: p.path, title: p.title, description: p.description, focusKeyword: p.focusKeyword ?? p.keywords[0] ?? null, type: p.type, overridden: p.overridden, onpage: oc, technical: tc, generative: gc, local: lc, overall, grade: grade(overall), issues };
}

// Curated static pages with representative metadata (treatment pages below carry
// their real metadata from lib/treatments.ts).
const STATIC: Omit<PageInput, 'overridden' | 'noindex'>[] = [
  { path: '/', title: 'K Clinics — Aesthetics & Dentistry in Islington, London', description: 'Award-winning aesthetics and dentistry in Islington, London. Laser, skin, injectables and smile design — book your appointment online today.', keywords: ['aesthetics clinic London', 'Islington'], type: 'home', hasSchema: true, hasFaq: false, ogImage: true },
  { path: '/treatments', title: 'Aesthetic Treatments in London | K Clinics', description: 'Explore the full menu of aesthetic treatments at K Clinics, Islington — laser, skin rejuvenation, HIFU, injectables and body contouring.', keywords: ['aesthetic treatments London'], type: 'hub', hasSchema: true, hasFaq: false, ogImage: true },
  { path: '/dentistry', title: 'Cosmetic & General Dentistry in London | K Clinics', description: 'Veneers, whitening, implants and complete smile design at K Clinics, Islington. Gentle, expert dental care in London.', keywords: ['cosmetic dentistry London'], type: 'hub', hasSchema: true, hasFaq: false, ogImage: true },
  { path: '/pricing', title: 'Price List — Aesthetics & Laser Treatments in London | K Clinics', description: 'Full, transparent price list for K Clinics, Islington — laser hair removal, HIFU, HydraFacial, tattoo and pigmentation removal, and more.', keywords: ['laser hair removal prices London'], type: 'commerce', hasSchema: false, hasFaq: false, ogImage: true },
  { path: '/packages', title: 'Treatment Packages & Courses | K Clinics London', description: 'Curated treatment packages and course savings at K Clinics, Islington — better results and better value across laser and skin.', keywords: ['treatment packages London'], type: 'commerce', hasSchema: false, hasFaq: false, ogImage: true },
  { path: '/academy', title: 'K Academy — Accredited Aesthetics Training in London | K Clinics', description: 'Train as an aesthetics practitioner at K Academy, Islington. Ofqual-regulated, VTCT and CPD-accredited courses from Level 2 to Level 7.', keywords: ['aesthetics training London', 'VTCT course'], type: 'academy', hasSchema: true, hasFaq: false, ogImage: true },
  { path: '/book', title: 'Book an Appointment — Islington, London | K Clinics', description: 'Book your appointment at K Clinics, Islington. Create your account for 15% off your first visit; pay only when your treatment is delivered.', keywords: ['book appointment London'], type: 'commerce', hasSchema: false, hasFaq: false, ogImage: true },
  { path: '/about', title: 'About K Clinics — Our Philosophy | Islington, London', description: 'The story and philosophy behind K Clinics — expert-led aesthetics and dentistry in the heart of Islington, London.', keywords: ['about K Clinics London'], type: 'content', hasSchema: true, hasFaq: false, ogImage: true },
  { path: '/team', title: 'Our Team — Expert Clinicians | K Clinics London', description: 'Meet the clinicians behind K Clinics, Islington — a team of expert practitioners in aesthetics and dentistry.', keywords: ['aesthetic doctors London'], type: 'content', hasSchema: false, hasFaq: false, ogImage: true },
  { path: '/contact', title: 'Contact & Find Us — K Clinics, Islington London', description: 'Visit K Clinics in Islington, London. Find our address, opening hours and contact details, or book online in seconds.', keywords: ['clinic Islington London', 'near me'], type: 'contact', hasSchema: true, hasFaq: false, ogImage: true },
  { path: '/reviews', title: 'Reviews — Loved by London | K Clinics', description: 'Read verified client reviews of K Clinics, Islington — the results and the experience, in our clients’ own words.', keywords: ['K Clinics reviews London'], type: 'content', hasSchema: true, hasFaq: false, ogImage: true },
  { path: '/faq', title: 'Frequently Asked Questions | K Clinics London', description: 'Answers to common questions about treatments, booking, aftercare and payment at K Clinics, Islington, London.', keywords: ['aesthetics FAQ London'], type: 'content', hasSchema: true, hasFaq: true, ogImage: true },
  { path: '/treatment-finder', title: 'Treatment Finder — Find Your Ideal Treatment | K Clinics', description: 'Answer a few questions and we’ll recommend the ideal treatments for your goals at K Clinics, Islington, London.', keywords: ['treatment finder London'], type: 'content', hasSchema: false, hasFaq: false, ogImage: true },
  { path: '/membership', title: 'Membership & Rewards — Beauty Points | K Clinics London', description: 'Join K Clinics membership and earn Beauty Points on every visit, with member pricing and perks across aesthetics and dentistry.', keywords: ['clinic membership London'], type: 'content', hasSchema: false, hasFaq: false, ogImage: true },
];

/** Build the scored page registry, merging PageSeo overrides over defaults. */
export async function auditSite(): Promise<{ pages: PageScore[]; health: number; byCategory: Record<Category, number>; counts: Record<string, number> }> {
  const overrides = await db.pageSeo.findMany().catch(() => []);
  const ovMap = new Map(overrides.map((o) => [o.path, o]));

  const treatmentPages: Omit<PageInput, 'overridden' | 'noindex'>[] = treatments.map((t) => ({
    path: `/${t.slug}`,
    title: t.metaTitle,
    description: t.metaDescription,
    keywords: t.keywords ?? [],
    focusKeyword: t.keywords?.[0],
    type: 'treatment',
    hasSchema: true,                 // treatment pages emit Service + Breadcrumb LD
    hasFaq: (t.faqs?.length ?? 0) > 0,
    ogImage: true,
  }));

  const base = [...STATIC, ...treatmentPages];
  const pages = base.map((b) => {
    const ov = ovMap.get(b.path);
    const merged: PageInput = {
      ...b,
      title: ov?.title || b.title,
      description: ov?.description || b.description,
      focusKeyword: ov?.focusKeyword || b.focusKeyword || b.keywords[0],
      ogImage: ov?.ogImage ? true : b.ogImage,
      noindex: ov?.noindex ?? false,
      overridden: !!ov,
    };
    return scorePage(merged);
  }).sort((a, b) => a.overall - b.overall);

  const avg = (sel: (p: PageScore) => number) => (pages.length ? clamp(pages.reduce((s, p) => s + sel(p), 0) / pages.length) : 0);
  const health = avg((p) => p.overall);
  const byCategory: Record<Category, number> = { onpage: avg((p) => p.onpage), technical: avg((p) => p.technical), generative: avg((p) => p.generative), local: avg((p) => p.local) };
  const counts = {
    total: pages.length,
    a: pages.filter((p) => p.grade === 'A').length,
    needsWork: pages.filter((p) => p.overall < 70).length,
    highIssues: pages.reduce((s, p) => s + p.issues.filter((i) => i.severity === 'high').length, 0),
  };
  return { pages, health, byCategory, counts };
}

/** Merge a page's SEO override over code defaults (used in generateMetadata). */
export async function getPageOverride(path: string) {
  return db.pageSeo.findUnique({ where: { path } }).catch(() => null);
}
