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
        disallow: ['/admin', '/kiosk', '/pos-paid', '/live', '/nps', '/follow-up', '/room-display', '/qr', '/sign', '/account', '/api/', '/booking/manage', '/academy/portal', '/academy/learn', '/academy/practice', '/academy/revise', '/academy/exercises', '/academy/demos', '/academy/community', '/academy/portfolio', '/academy/leaderboard', '/academy/settings', '/search', '/shop/cart', '/shop/checkout', '/preview', '/waitlist/claim'],
      },
    ],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
