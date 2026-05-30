import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';
import { treatmentSlugs } from '@/lib/treatments';
import { packages } from '@/lib/packages';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const base = site.url;

  const staticPaths: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
    { path: '/', priority: 1, freq: 'weekly' },
    { path: '/treatments', priority: 0.9, freq: 'weekly' },
    { path: '/dentistry', priority: 0.9, freq: 'weekly' },
    { path: '/packages', priority: 0.8, freq: 'monthly' },
    { path: '/pricing', priority: 0.8, freq: 'monthly' },
    { path: '/about', priority: 0.6, freq: 'monthly' },
    { path: '/membership', priority: 0.6, freq: 'monthly' },
    { path: '/reviews', priority: 0.6, freq: 'weekly' },
    { path: '/faq', priority: 0.5, freq: 'monthly' },
    { path: '/contact', priority: 0.7, freq: 'monthly' },
  ];

  return [
    ...staticPaths.map((p) => ({
      url: `${base}${p.path}`,
      lastModified: now,
      changeFrequency: p.freq,
      priority: p.priority,
    })),
    ...treatmentSlugs.map((slug) => ({
      url: `${base}/${slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...packages.map((p) => ({
      url: `${base}/packages/${p.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
