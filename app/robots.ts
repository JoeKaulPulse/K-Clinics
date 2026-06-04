import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Private / transactional areas — keep out of the index & crawl budget.
        disallow: ['/admin', '/account', '/api/', '/booking/manage', '/academy/portal', '/academy/learn', '/search', '/shop/cart', '/shop/checkout', '/preview'],
      },
    ],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
