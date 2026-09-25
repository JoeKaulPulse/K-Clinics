import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';

export const dynamic = 'force-static';

// /kiosk is disallowed below as a PREFIX, which also covered
// /kiosk/result/[slug] — the public, shareable Skin & Smile card that
// BLD-1624 made indexable. A page a crawler may not fetch cannot be
// indexed on the strength of its own meta robots tag (the tag is never
// read), so the longer, more specific Allow has to sit alongside the
// Disallow. Longest-match wins for Google and Bing.
// BLD-1636: same problem one level down. That page's og:image/twitter:image
// is the branded card at /api/kiosk/results/[id-or-slug]/card, and '/api/'
// is disallowed below as a prefix. facebookexternalhit and Twitterbot both
// honour robots.txt when fetching preview images, so without this Allow the
// two platforms the meta tags were added for would still unfurl imageless.
// Nothing else under this prefix is linked from anywhere a crawler can
// reach, and the card shows only what the share page already shows.
const ALLOW = ['/', '/kiosk/result/', '/api/kiosk/results/', '/llms.txt', '/llms-full.txt'];

// Private / transactional areas — keep out of the index & crawl budget.
// Note: these are PREFIX matches. '/review/' keeps the trailing slash on
// purpose — a bare '/review' would also block the public, sitemap-listed
// /reviews marketing page. Only the token-gated /review/[token] is private.
const DISALLOW = ['/admin', '/kiosk', '/pos-paid', '/live', '/nps', '/follow-up', '/room-display', '/qr', '/sign', '/review/', '/account', '/api/', '/booking/manage', '/academy/portal', '/academy/learn', '/academy/practice', '/academy/revise', '/academy/exercises', '/academy/demos', '/academy/community', '/academy/portfolio', '/academy/leaderboard', '/academy/settings', '/search', '/shop/cart', '/shop/checkout', '/preview', '/waitlist/claim'];

// GEO (generative engine optimisation): the answer-engine and AI-assistant
// crawlers get an explicit group with the SAME allow/disallow as everyone
// else. Several of them (GPTBot, ClaudeBot, PerplexityBot, Google-Extended)
// look for a group naming them before falling back to '*', and an explicit
// allow is the clearest signal that public clinic and academy content may be
// read and cited. Private areas stay blocked for them exactly as for Google.
const AI_AGENTS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
  'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai',
  'PerplexityBot', 'Perplexity-User',
  'Google-Extended', 'Applebot-Extended', 'Amazonbot', 'meta-externalagent',
  'DuckAssistBot', 'CCBot', 'cohere-ai', 'YouBot',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: ALLOW, disallow: DISALLOW },
      { userAgent: AI_AGENTS, allow: ALLOW, disallow: DISALLOW },
    ],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
