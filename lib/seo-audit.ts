import 'server-only';
import { db } from '@/lib/db';
import { treatments } from '@/lib/treatments';
import { articles } from '@/lib/articles';
import { packages } from '@/lib/packages';
import { infoPages } from '@/lib/info-pages';

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
// Accurate per-page registry mirroring each page's live metadata. Used to score
// the whole site in the SEO centre and as the seed an admin edits/overrides.
const STATIC: Omit<PageInput, 'overridden' | 'noindex'>[] = [
  { path: '/', title: 'KClinics — Aesthetics & Aesthetic Dentistry, Reimagined | Islington, London', description: 'Advanced laser & skin aesthetics and aesthetic dentistry under one roof in Islington, London. Qualified clinicians, bespoke plans — book online today.', keywords: ['aesthetics clinic London', 'aesthetic dentistry Islington', 'laser clinic London'], type: 'home', hasSchema: true, hasFaq: true, ogImage: true },
  { path: '/treatments', title: 'Aesthetic Treatments in London — Laser, Skin & Body | KClinics', description: 'Explore KClinics’ full menu of aesthetic treatments in Islington, London — laser hair removal, HIFU lifting, advanced facials, body contouring and injectables.', keywords: ['aesthetic clinic London', 'laser clinic Islington', 'skin treatments London', 'non-surgical treatments'], type: 'hub', hasSchema: true, hasFaq: false, ogImage: true },
  { path: '/dentistry', title: 'Aesthetic & General Dentistry in London — Opening Soon | KClinics', description: 'Aesthetic dentistry coming soon to KClinics, Islington — porcelain veneers, teeth whitening, composite bonding, dental implants and specialist care. Register your interest.', keywords: ['cosmetic dentist London', 'dental clinic Islington', 'veneers London', 'dental implants London'], type: 'hub', hasSchema: true, hasFaq: false, ogImage: true },
  { path: '/pricing', title: 'Price List — Aesthetics & Laser Treatments in London | KClinics', description: 'Full, transparent price list for KClinics, Islington — laser hair removal, HIFU, HydraFacial, tattoo and pigmentation removal, injectables and more.', keywords: ['laser hair removal prices London', 'aesthetics prices Islington', 'treatment cost London'], type: 'commerce', hasSchema: true, hasFaq: false, ogImage: true },
  { path: '/packages', title: 'Treatment Packages & Programmes in London | KClinics', description: 'Curated treatment packages at KClinics, Islington — Total Rejuvenation, Perfect Skin, Smooth & Slim and Ultimate Hair-Free programmes for transformative, lasting results.', keywords: ['treatment packages London', 'skin programme London', 'body sculpting package', 'laser hair removal package'], type: 'commerce', hasSchema: false, hasFaq: false, ogImage: true },
  { path: '/offers', title: 'Special Offers & Savings | KClinics London', description: 'Current offers at KClinics, Islington — 15% off your first visit, complimentary consultations, refer-a-friend rewards, gift vouchers and savings on treatment packages.', keywords: ['aesthetics offers London', 'first visit discount clinic', 'treatment package savings'], type: 'commerce', hasSchema: false, hasFaq: false, ogImage: true },
  { path: '/finance', title: 'Cost & Finance — Flexible Payment Options | KClinics London', description: 'Spread the cost of your treatment at KClinics, Islington. Transparent pricing, pay-as-you-go courses, 0% interest-free options and Buy Now, Pay Later with Clearpay and Klarna.', keywords: ['pay monthly aesthetics London', 'buy now pay later clinic', '0% finance treatment', 'Clearpay Klarna clinic'], type: 'commerce', hasSchema: false, hasFaq: false, ogImage: true },
  { path: '/gift-vouchers', title: 'Gift Vouchers — Give the Gift of KClinics | London', description: 'Buy a KClinics gift voucher online in minutes. Choose any amount from £10 to £500, add a personal message, and we’ll email it instantly or on a date you choose.', keywords: ['KClinics gift voucher', 'beauty gift card London', 'aesthetics gift voucher', 'gift card Islington clinic'], type: 'commerce', hasSchema: false, hasFaq: false, ogImage: true },
  { path: '/book', title: 'Book an Appointment — Islington, London | KClinics', description: 'Book your appointment at KClinics, Islington. Create your account for 15% off your first visit; pay only when your treatment is delivered.', keywords: ['book appointment London', 'book aesthetics Islington'], type: 'commerce', hasSchema: false, hasFaq: false, ogImage: true },
  { path: '/consultation', title: 'Book a Free Consultation — Islington, London | KClinics', description: 'Request your complimentary consultation at KClinics, Islington. Tell us your goals and our expert team will design a bespoke treatment plan. New clients enjoy 15% off.', keywords: ['free consultation London', 'aesthetics consultation Islington', 'book consultation clinic'], type: 'contact', hasSchema: false, hasFaq: false, ogImage: true },
  { path: '/ai-consultation', title: 'Get My Plan — AI Skin, Smile & Hair Consultation | KClinics', description: 'Upload a photo and our AI analyses your skin, smile and hair, then builds a personalised, phased, bookable treatment plan to your budget. Free with a KClinics account.', keywords: ['AI skin analysis London', 'AI consultation aesthetics', 'personalised treatment plan'], type: 'content', hasSchema: false, hasFaq: false, ogImage: true },
  { path: '/treatment-finder', title: 'Treatment Finder — Find Your Ideal Treatment | KClinics', description: 'Answer a few questions and we’ll recommend the ideal treatments for your goals at KClinics, Islington, London.', keywords: ['treatment finder London', 'which treatment aesthetics'], type: 'content', hasSchema: false, hasFaq: false, ogImage: true },
  { path: '/gallery', title: 'Before & After Gallery | KClinics London', description: 'Real client before-and-after results from KClinics, Islington — published only with the client’s consent. Drag any case to reveal the transformation.', keywords: ['before after KClinics', 'aesthetics results London', 'aesthetic dentistry results Islington'], type: 'content', hasSchema: false, hasFaq: false, ogImage: true },
  { path: '/reviews', title: 'Client Reviews — Verified & Genuine | KClinics', description: 'Read verified client reviews of KClinics, Islington — the results and the experience, in our clients’ own words.', keywords: ['KClinics reviews London', 'aesthetics reviews Islington'], type: 'content', hasSchema: true, hasFaq: false, ogImage: true },
  { path: '/journal', title: 'The Journal — Expert Skin, Laser & Dentistry Guides | KClinics London', description: 'Expert guidance from KClinics, Islington — honest, practical articles on laser, skin, injectables and aesthetic dentistry to help you make confident, informed choices.', keywords: ['aesthetics blog London', 'skincare advice', 'laser hair removal guide', 'aesthetic dentistry tips'], type: 'content', hasSchema: false, hasFaq: false, ogImage: true },
  { path: '/about', title: 'About KClinics — Our Philosophy | Islington, London', description: 'The story and philosophy behind KClinics — expert-led aesthetics and dentistry in the heart of Islington, London.', keywords: ['about KClinics London', 'aesthetics clinic story'], type: 'content', hasSchema: true, hasFaq: false, ogImage: true },
  { path: '/team', title: 'Our Team — Expert Clinicians | KClinics London', description: 'Meet the clinicians behind KClinics, Islington — a team of expert practitioners in aesthetics and dentistry.', keywords: ['aesthetic doctors London', 'clinicians Islington'], type: 'content', hasSchema: true, hasFaq: false, ogImage: true },
  { path: '/membership', title: 'Membership & Rewards — Beauty Points | KClinics London', description: 'Join KClinics membership and earn Beauty Points on every visit, with member pricing and perks across aesthetics and dentistry.', keywords: ['clinic membership London', 'beauty rewards Islington'], type: 'content', hasSchema: false, hasFaq: false, ogImage: true },
  { path: '/refer-a-friend', title: 'Refer a Friend — Give £25, Get £25 | KClinics London', description: 'Share KClinics with a friend: they get £25 off their first treatment and you get £25 credit when they visit. Generous, simple, and automatic.', keywords: ['refer a friend', 'KClinics referral', 'aesthetics referral London'], type: 'content', hasSchema: false, hasFaq: false, ogImage: true },
  { path: '/careers', title: 'Careers — Join KClinics | Islington, London', description: 'Build your career at KClinics, Islington — a place that invests in its people. See our live vacancies and apply, or send a speculative application.', keywords: ['aesthetics jobs London', 'clinic careers Islington', 'cosmetic dentistry jobs'], type: 'content', hasSchema: false, hasFaq: false, ogImage: true },
  { path: '/faq', title: 'Frequently Asked Questions | KClinics London', description: 'Answers to common questions about treatments, booking, aftercare and payment at KClinics, Islington, London.', keywords: ['aesthetics FAQ London', 'clinic questions Islington'], type: 'content', hasSchema: true, hasFaq: true, ogImage: true },
  { path: '/contact', title: 'Contact & Find Us — KClinics, Islington London', description: 'Visit KClinics in Islington, London. Find our address, opening hours and contact details, or book online in seconds.', keywords: ['clinic Islington London', 'near me', 'contact KClinics'], type: 'contact', hasSchema: true, hasFaq: false, ogImage: true },
  { path: '/clinics', title: 'Our Clinic — Find Us in Islington, London | KClinics', description: 'Visit KClinics on the border of the City of London and Islington — 4 Charterhouse Buildings, Goswell Road, EC1M 7AN. Step-free access and minutes from Barbican, Farringdon and Old Street.', keywords: ['KClinics location', 'aesthetics clinic Islington', 'clinic near Barbican Farringdon'], type: 'contact', hasSchema: true, hasFaq: false, ogImage: true },
  { path: '/academy', title: 'K Academy — Accredited Aesthetics Training in London | KClinics', description: 'Train as an aesthetics practitioner at K Academy, Islington. Ofqual-regulated, VTCT and CPD-accredited courses from Level 2 to Level 7.', keywords: ['aesthetics training London', 'VTCT course', 'CPD aesthetics course'], type: 'academy', hasSchema: true, hasFaq: false, ogImage: true },
];

/** Build the scored page registry, merging PageSeo overrides over defaults. */
export async function auditSite(): Promise<{ pages: PageScore[]; health: number; byCategory: Record<Category, number>; counts: Record<string, number> }> {
  const overrides = await db.pageSeo.findMany().catch(() => []);
  const ovMap = new Map(overrides.map((o) => [o.path, o]));

  type Entry = Omit<PageInput, 'overridden' | 'noindex'>;

  // Every content source is enumerated dynamically, so a new treatment, blog
  // post, package, info page or academy course is picked up by the SEO centre
  // automatically — no separate registry to maintain.
  const treatmentPages: Entry[] = treatments.map((t) => ({
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

  const articlePages: Entry[] = articles.map((a) => ({
    path: `/journal/${a.slug}`,
    title: `${a.title} | KClinics Journal`,
    description: a.metaDescription,
    keywords: a.keywords ?? [],
    focusKeyword: a.keywords?.[0],
    type: 'content',
    hasSchema: true,                 // journal posts emit Article + Breadcrumb LD
    hasFaq: false,
    ogImage: true,
  }));

  const packagePages: Entry[] = packages.map((p) => ({
    path: `/packages/${p.slug}`,
    title: `${p.name} Package — ${p.subtitle} | KClinics London`,
    description: `${p.description} Available at KClinics, Islington, London.`.slice(0, 300),
    keywords: [`${p.name} package London`, 'treatment package Islington'],
    type: 'commerce',
    hasSchema: true,                 // breadcrumb LD
    hasFaq: false,
    ogImage: true,
  }));

  const infoPagesList: Entry[] = infoPages.map((p) => ({
    path: `/info/${p.slug}`,
    title: `${p.title} | KClinics`,
    description: p.intro.slice(0, 160),
    keywords: [],
    type: 'content',
    hasSchema: false,
    hasFaq: false,
    ogImage: true,
  }));

  // Academy courses live in the DB → query live (best-effort).
  let coursePages: Entry[] = [];
  try {
    const { listCourses } = await import('@/lib/academy');
    const courses = await listCourses(false);
    coursePages = courses.map((c) => ({
      path: `/academy/${c.slug}`,
      title: `${c.title}${c.level ? ` (${c.level})` : ''} — K Academy`,
      description: c.summary || `Accredited aesthetics training: ${c.title} at K Academy, Islington, London.`,
      keywords: ['aesthetics course London', `${c.title} course`],
      focusKeyword: 'aesthetics course London',
      type: 'academy',
      hasSchema: true,               // courseLd
      hasFaq: false,
      ogImage: true,
    }));
  } catch { /* DB optional */ }

  const base = [...STATIC, ...treatmentPages, ...articlePages, ...packagePages, ...infoPagesList, ...coursePages];
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
