import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        // /kiosk is disallowed below as a PREFIX, which also covered
        // /kiosk/result/[slug] — the public, shareable Skin & Smile card that
        // BLD-1624 made indexable. A page a crawler may not fetch cannot be
        // indexed on the strength of its own meta robots tag (the tag is never
        // read), so the longer, more specific Allow has to sit alongside the
        // Disallow. Longest-match wins for Google and Bing.
        allow: ['/', '/kiosk/result/'],
        // Private / transactional areas — keep out of the index & crawl budget.
        // Note: these are PREFIX matches. '/review/' keeps the trailing slash on
        // purpose — a bare '/review' would also block the public, sitemap-listed
        // /reviews marketing page. Only the token-gated /review/[token] is private.
        disallow: ['/admin', '/kiosk', '/pos-paid', '/live', '/nps', '/follow-up', '/room-display', '/qr', '/sign', '/review/', '/account', '/api/', '/booking/manage', '/academy/portal', '/academy/learn', '/academy/practice', '/academy/revise', '/academy/exercises', '/academy/demos', '/academy/community', '/academy/portfolio', '/academy/leaderboard', '/academy/settings', '/search', '/shop/cart', '/shop/checkout', '/preview', '/waitlist/claim'],
      },
    ],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
