import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';
import { treatmentSlugs, dentistry } from '@/lib/treatments';
import { packages } from '@/lib/packages';
import { infoSlugs } from '@/lib/info-pages';
import { articles } from '@/lib/articles';
import { getSiteConfig } from '@/lib/site-config';

// ISR so newly-published academy courses (DB-backed) appear without a redeploy.
export const revalidate = 3600;

// Stable "content last reviewed" anchor for our largely-static marketing pages.
// Using a fixed date (rather than `new Date()`) keeps <lastmod> honest — search
// engines distrust sitemaps that claim every URL changed on every crawl. Bump
// this when marketing copy is meaningfully refreshed.
const CONTENT_REVIEWED = new Date('2026-06-01T00:00:00Z');

// Fallback academy slugs if the DB can't be reached at build/revalidate time.
const FALLBACK_COURSE_SLUGS = ['level-2-foundation-skin-laser', 'level-3-laser-aesthetic-therapies', 'level-4-certificate-aesthetic-practice', 'advanced-aesthetics-level-5-7'];

async function courseSlugs(): Promise<string[]> {
  try {
    const { listCourses } = await import('@/lib/academy');
    const courses = await listCourses(false);
    return courses.length ? courses.map((c) => c.slug) : FALLBACK_COURSE_SLUGS;
  } catch {
    return FALLBACK_COURSE_SLUGS;
  }
}

// Published academy bundles (DB-backed) so /academy/bundles/<slug> pages are
// crawlable + AI-citable (BLD-651). Best-effort — an unreachable DB just omits them.
async function bundleSlugs(): Promise<string[]> {
  try {
    const { listBundles } = await import('@/lib/academy');
    return (await listBundles()).map((b) => b.slug);
  } catch {
    return [];
  }
}

// Active shop products (DB-backed) so product pages are discoverable. Best-effort
// — an unreachable DB at build/revalidate just omits them.
async function shopProducts(): Promise<{ slug: string; updated: Date }[]> {
  try {
    const { activeProducts } = await import('@/lib/shop');
    return (await activeProducts()).map((p) => ({ slug: p.slug, updated: p.updatedAt }));
  } catch {
    return [];
  }
}

// Journal cards: DB-backed posts (lib/blog.ts listBlogCards, source of truth for
// /journal and /journal/[slug]) plus any native article not overridden in the DB.
// Falls back to the static articles array if the DB is unreachable (BLD-917 —
// the static `articles` array alone only covered 6 of 72+ live journal URLs).
async function journalCards(): Promise<{ slug: string; updated: Date }[]> {
  try {
    const { listBlogCards } = await import('@/lib/blog');
    const cards = await listBlogCards();
    return cards.length
      ? cards.map((c) => ({ slug: c.slug, updated: new Date(c.published) }))
      : articles.map((a) => ({ slug: a.slug, updated: new Date(a.updated || a.published) }));
  } catch {
    return articles.map((a) => ({ slug: a.slug, updated: new Date(a.updated || a.published) }));
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const reviewed = CONTENT_REVIEWED;
  const base = site.url;
  // BLD-839: dentistry treatment pages render noindex (app/(marketing)/[slug]/page.tsx,
  // app/(marketing)/dentistry/page.tsx) while dentistryLive is false -- keep them, and
  // the /dentistry hub, out of the sitemap too, so we never advertise noindexed URLs.
  const { dentistryLive } = await getSiteConfig();
  const dentistrySlugs = new Set(dentistry.map((t) => t.slug));

  const staticPaths: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
    { path: '/', priority: 1, freq: 'weekly' },
    { path: '/book', priority: 0.95, freq: 'monthly' },
    { path: '/consultation', priority: 0.9, freq: 'monthly' },
    { path: '/treatments', priority: 0.9, freq: 'weekly' },
    { path: '/treatment-finder', priority: 0.75, freq: 'monthly' },
    { path: '/ai-consultation', priority: 0.8, freq: 'monthly' },
    { path: '/journal', priority: 0.7, freq: 'weekly' },
    ...(dentistryLive ? [{ path: '/dentistry', priority: 0.9, freq: 'weekly' as const }] : []),
    { path: '/packages', priority: 0.8, freq: 'monthly' },
    { path: '/pricing', priority: 0.8, freq: 'monthly' },
    { path: '/offers', priority: 0.7, freq: 'weekly' },
    { path: '/shop', priority: 0.7, freq: 'weekly' },
    { path: '/gallery', priority: 0.6, freq: 'monthly' },
    { path: '/finance', priority: 0.6, freq: 'monthly' },
    { path: '/academy', priority: 0.8, freq: 'weekly' },
    { path: '/academy/bundles', priority: 0.7, freq: 'monthly' },
    { path: '/academy/funding', priority: 0.65, freq: 'monthly' },
    { path: '/about', priority: 0.6, freq: 'monthly' },
    { path: '/team', priority: 0.7, freq: 'monthly' },
    { path: '/clinics', priority: 0.7, freq: 'monthly' },
    { path: '/membership', priority: 0.6, freq: 'monthly' },
    { path: '/reviews', priority: 0.6, freq: 'weekly' },
    { path: '/refer-a-friend', priority: 0.5, freq: 'monthly' },
    { path: '/gift-vouchers', priority: 0.6, freq: 'monthly' },
    { path: '/group-bookings', priority: 0.6, freq: 'monthly' },
    { path: '/careers', priority: 0.4, freq: 'weekly' },
    { path: '/faq', priority: 0.5, freq: 'monthly' },
    { path: '/contact', priority: 0.7, freq: 'monthly' },
  ];

  return [
    ...staticPaths.map((p) => ({
      url: `${base}${p.path}`,
      lastModified: reviewed,
      changeFrequency: p.freq,
      priority: p.priority,
    })),
    ...treatmentSlugs.filter((slug) => dentistryLive || !dentistrySlugs.has(slug)).map((slug) => ({
      url: `${base}/${slug}`,
      lastModified: reviewed,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...packages.map((p) => ({
      url: `${base}/packages/${p.slug}`,
      lastModified: reviewed,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    // BLD-535: refer-a-friend info page is incorrect (£50 vs live £25/£25) and
    // redirects to /refer-a-friend — exclude from sitemap so search engines
    // don't index the outdated commercial claim.
    ...infoSlugs.filter((slug) => slug !== 'refer-a-friend').map((slug) => ({
      url: `${base}/info/${slug}`,
      lastModified: reviewed,
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    })),
    ...(await journalCards()).map((c) => ({
      url: `${base}/journal/${c.slug}`,
      // Real per-article date so freshness signals are trustworthy.
      lastModified: c.updated,
      changeFrequency: 'monthly' as const,
      priority: 0.55,
    })),
    ...(await courseSlugs()).map((slug) => ({
      url: `${base}/academy/${slug}`,
      lastModified: reviewed,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    ...(await bundleSlugs()).map((slug) => ({
      url: `${base}/academy/bundles/${slug}`,
      lastModified: reviewed,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    ...(await shopProducts()).map((p) => ({
      url: `${base}/shop/${p.slug}`,
      lastModified: p.updated,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ];
}
