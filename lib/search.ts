import 'server-only';
import { treatments } from '@/lib/treatments';
import { crmEnabled } from '@/lib/crm';
import { relevance, queryTerms } from '@/lib/search-rank';

// Lightweight public site search across treatments (static marketing pages),
// journal posts (DB) and key pages. Replaces the old SearchWP plugin.
export type SearchHit = { type: 'Treatment' | 'Article' | 'Page'; title: string; href: string; excerpt: string; score?: number };

// A gentle prior on type: when match quality is otherwise similar, a treatment
// or page (a navigational destination) is usually what a visitor wants ahead of
// a blog article.
const TYPE_WEIGHT: Record<SearchHit['type'], number> = { Treatment: 1, Page: 0.95, Article: 0.82 };
export type SearchResults = { query: string; hits: SearchHit[]; total: number };

// Core marketing pages worth surfacing by name.
const PAGES: { title: string; href: string; keywords: string }[] = [
  { title: 'Price list', href: '/pricing', keywords: 'prices cost pricing how much fees' },
  { title: 'Special offers', href: '/offers', keywords: 'offers deals discounts promotions seasonal' },
  { title: 'Packages', href: '/packages', keywords: 'packages bundles courses' },
  { title: 'Membership', href: '/membership', keywords: 'membership plan subscription' },
  { title: 'Gift vouchers', href: '/gift-vouchers', keywords: 'gift voucher card present' },
  { title: 'Finance & payment plans', href: '/finance', keywords: 'finance payment plan instalments klarna 0%' },
  { title: 'Book an appointment', href: '/book', keywords: 'book booking appointment reserve' },
  { title: 'Contact us', href: '/contact', keywords: 'contact phone email address location enquiry' },
  { title: 'About KClinics', href: '/about', keywords: 'about clinic story team values' },
  { title: 'Academy', href: '/academy', keywords: 'academy training courses learn aesthetics' },
  { title: 'Reviews', href: '/reviews', keywords: 'reviews testimonials feedback ratings' },
  { title: 'Before & after gallery', href: '/gallery', keywords: 'gallery before after results photos' },
];

const norm = (s: string) => s.toLowerCase();

export async function searchSite(rawQuery: string, limit = 24): Promise<SearchResults> {
  const query = (rawQuery || '').trim().slice(0, 80);
  if (query.length < 2) return { query, hits: [], total: 0 };
  const q = norm(query);
  const terms = queryTerms(q);
  const matchAll = (hay: string) => { const h = norm(hay); return terms.every((t) => h.includes(t)); };
  const score = (title: string, rest: string, type: SearchHit['type']) =>
    (relevance(title, q, terms) + 0.4 * relevance(rest, q, terms)) * TYPE_WEIGHT[type];

  const hits: SearchHit[] = [];

  // Treatments (static marketing pages).
  for (const t of treatments) {
    const rest = `${t.group} ${t.tagline ?? ''} ${t.intro ?? ''} ${t.eyebrow ?? ''}`;
    if (matchAll(`${t.title} ${rest}`)) hits.push({ type: 'Treatment', title: t.title, href: `/${t.slug}`, excerpt: (t.tagline || t.intro || '').slice(0, 140), score: score(t.title, rest, 'Treatment') });
  }

  // Pages.
  for (const p of PAGES) {
    if (matchAll(`${p.title} ${p.keywords}`)) hits.push({ type: 'Page', title: p.title, href: p.href, excerpt: '', score: score(p.title, p.keywords, 'Page') });
  }

  // Journal articles (published).
  if (crmEnabled) {
    try {
      const { db } = await import('@/lib/db');
      const posts = await db.post.findMany({
        where: {
          status: 'PUBLISHED',
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { excerpt: { contains: query, mode: 'insensitive' } },
            { category: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { slug: true, title: true, excerpt: true, category: true },
        orderBy: { publishedAt: 'desc' },
        take: 12,
      });
      for (const p of posts) hits.push({ type: 'Article', title: p.title, href: `/journal/${p.slug}`, excerpt: (p.excerpt ?? '').slice(0, 140), score: score(p.title, `${p.excerpt ?? ''} ${p.category ?? ''}`, 'Article') });
    } catch { /* DB unavailable → treatments/pages only */ }
  }

  // Most relevant first (recency only breaks exact ties within articles).
  hits.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return { query, hits: hits.slice(0, limit), total: hits.length };
}
