import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';
import { treatmentSlugs } from '@/lib/treatments';
import { packages } from '@/lib/packages';
import { infoSlugs } from '@/lib/info-pages';
import { articles } from '@/lib/articles';

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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const reviewed = CONTENT_REVIEWED;
  const base = site.url;

  const staticPaths: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
    { path: '/', priority: 1, freq: 'weekly' },
    { path: '/book', priority: 0.95, freq: 'monthly' },
    { path: '/consultation', priority: 0.9, freq: 'monthly' },
    { path: '/treatments', priority: 0.9, freq: 'weekly' },
    { path: '/treatment-finder', priority: 0.75, freq: 'monthly' },
    { path: '/ai-consultation', priority: 0.8, freq: 'monthly' },
    { path: '/journal', priority: 0.7, freq: 'weekly' },
    { path: '/dentistry', priority: 0.9, freq: 'weekly' },
    { path: '/packages', priority: 0.8, freq: 'monthly' },
    { path: '/pricing', priority: 0.8, freq: 'monthly' },
    { path: '/offers', priority: 0.7, freq: 'weekly' },
    { path: '/gallery', priority: 0.6, freq: 'monthly' },
    { path: '/finance', priority: 0.6, freq: 'monthly' },
    { path: '/academy', priority: 0.8, freq: 'weekly' },
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
    ...treatmentSlugs.map((slug) => ({
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
    ...infoSlugs.map((slug) => ({
      url: `${base}/info/${slug}`,
      lastModified: reviewed,
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    })),
    ...articles.map((a) => ({
      url: `${base}/journal/${a.slug}`,
      // Real per-article date so freshness signals are trustworthy.
      lastModified: new Date(a.updated || a.published),
      changeFrequency: 'monthly' as const,
      priority: 0.55,
    })),
    ...(await courseSlugs()).map((slug) => ({
      url: `${base}/academy/${slug}`,
      lastModified: reviewed,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
