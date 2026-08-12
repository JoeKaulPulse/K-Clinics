import 'server-only';
import { db } from './db';
import { sortedArticles, getArticle, type Article, type ArticleBlock } from './articles';
import { articleImage, resolveMigratedImage } from './treatment-images';
import { asBlocks, htmlToBlocks, type Block } from './blocks';
import { sanitizeHtml, escapeHtml } from './sanitize';

// BLD-1230: rewrite any <img src="...wp-content/uploads/..."> left over from the
// WordPress import to its migrated local copy (see resolveMigratedImage) so
// article bodies don't 403 against the live firewall's /wp-content block.
function rewriteMigratedImageSrcs(html: string): string {
  return html.replace(/\bsrc="([^"]*\/wp-content\/uploads\/[^"]+)"/gi, (full, url) => {
    const resolved = resolveMigratedImage(url);
    return resolved && resolved !== url ? `src="${escapeHtml(resolved)}"` : full;
  });
}

// DB-backed journal. Admin-managed Post rows are the source of truth; the native
// curated articles (lib/articles.ts) still render for any slug NOT in the DB, so
// nothing disappears before/after the import and the page never breaks if the
// Post table isn't migrated yet.

export type BlogCard = { slug: string; title: string; excerpt: string; category: string; readMinutes: number; published: string; image: string | null };
export type BlogPost = {
  slug: string; title: string; excerpt: string; metaDescription: string; category: string;
  readMinutes: number; published: string; updated?: string; html: string;
  keywords: string[]; related: string[]; image: string | null;
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Render the native article block format to HTML (for fallback + seeding). */
export function blocksToHtml(blocks: ArticleBlock[]): string {
  return blocks.map((b) => {
    if (b.type === 'h2') return `<h2>${esc(b.text)}</h2>`;
    if (b.type === 'ul') return `<ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
    return `<p>${esc(b.text)}</p>`;
  }).join('\n');
}

// BLD-1182: WordPress-imported excerpts can carry leftover site-nav/breadcrumb
// text (e.g. "Cosmetology Blog Dentistry Blog {Title} {real excerpt}") — the
// original WP page dump included blog-category nav links and the page's own H1
// title ahead of the article body, and migrate-blog.mjs's excerptOf()/stripTags()
// strip HTML tags but not that leaked text. Strip both pieces before the excerpt
// is used as a meta description / JSON-LD description fallback:
//   1. A leading run of "<Capitalized word(s)> Blog" nav labels — deliberately
//      narrow (only that specific "<Title Case> Blog" shape, the confirmed
//      nav-label pattern), so a legitimate excerpt that merely starts with a
//      capitalized word is left untouched.
//   2. A leading duplicate of the post's own title, if given — but ONLY on an
//      excerpt that actually carried the nav labels in (1). In the WP dump the
//      leaked H1 always sits behind those labels, so requiring them is what
//      makes this safe: a title is very often a legitimate opening for real
//      prose too ("Microneedling" / "Microneedling is a collagen induction
//      therapy…", "Laser hair removal" / "Laser hair removal works by…"), and
//      stripping it unconditionally would leave a clean post's meta description
//      starting mid-sentence — the exact SEO damage this fix exists to undo
//      (BLD-1182 review).
// This is a read-time mitigation only — see BLD-1182 in lib/build-backlog.ts for
// the separate stored-`excerpt` cleanup.
//
// BLD-1289: the word "Blog" is inconsistently cased in the dump — live rows
// carry "Cosmetology Blog Dentistry blog" on the SAME post, because WP's
// category-widget markup always capitalised the category word and only "blog"
// was typed either way — so (1) has to accept both. The category word itself is
// Title Case in all 72 live rows, so `[Bb]log` is the whole of the widening.
//
// BLD-1289 (review): accepting a lower-case "blog" makes (1) alone too blunt to
// run on its own. "Our blog is where we share…", "This blog explains…" and "The
// blog covers…" are all "<Capitalized word> blog " and would have their opening
// words silently deleted from the meta description — the same SEO damage the
// note above exists to prevent, on a public page, with nothing to flag it. So
// (1) and (2) are now ONE decision rather than two: the labels are removed only
// when the post's own title follows them, which is the complete confirmed shape
// of the leak ("{labels} {Title} {real excerpt}") and is not something ordinary
// prose reproduces. Verified against all 72 live rows: all 11 polluted meta
// descriptions are cleaned (the same 11 the looser pattern caught), no other row
// is touched, and none of the prose cases above is.
export function stripNavChrome(text: string, title?: string): string {
  const trimmed = text.trim();
  const nav = /^(?:(?:[A-Z][a-z]+\s){0,2}[A-Z][a-z]+\s+[Bb]log\s+)+/.exec(trimmed);
  if (!nav) return trimmed;
  const rest = trimmed.slice(nav[0].length);
  const cleanTitle = title?.trim();
  // No title to corroborate against (legacy callers): fall back to removing the
  // labels alone, as before.
  if (!cleanTitle) return rest.trim();
  const escaped = cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const afterTitle = rest.replace(new RegExp(`^${escaped}\\s+`, 'i'), '');
  // The title does not follow the labels, so this is not the leaked shape —
  // leave the text exactly as it is rather than guessing.
  if (afterTitle === rest) return trimmed;
  return afterTitle.trim();
}

// BLD-1290: the same WordPress page dump that leaked nav-label text into
// excerpts (BLD-1182/1289 above) also leaked it, as real markup, into the
// article body itself — Post.content commonly opens with one or two leftover
// "category" nav links (e.g. <p><a href="/category/dentistry-blog/">Dentistry
// blog</a></p>) immediately followed by a second <h1> duplicating the post's
// own title (the journal template already renders its own H1 from the post
// title — see app/(marketing)/journal/[slug]/page.tsx). The /category/*-blog/
// links 404 live (that taxonomy was never migrated) and the duplicate <h1> is
// a duplicate-H1 SEO/accessibility defect.
//
// Confirmed shape (scraped from all 72 live /journal/[slug] pages before
// writing this): every polluted row opens with 1-2 of
//   <p><a href="/category/<slug>-blog/">…Blog</a></p>   (usual — wrapped + linked)
//   <a href="/category/<slug>-blog/">…Blog</a>          (rarer — bare, no <p>)
//   <p>…Blog</p>                                        (rarer — plain text, no link)
// where "…Blog" is a short (<=~30 char) label ending in the word "blog", then
// directly followed by <h1>…</h1> wrapping the title. 65 of 72 rows matched;
// the other 7 open with ordinary prose and must be left untouched.
//
// This is a READ-TIME mitigation, deliberately narrow to that confirmed
// shape, so a legitimate post is never touched:
//   1. Peel off a leading run (capped) of nav items matching one of the three
//      shapes above. Unconditional once matched — a /category/*-blog/ href is
//      never legitimate body content on this site, and the plain-text variant
//      must be the ENTIRE contents of its own <p> (not just a prefix), so a
//      real sentence that happens to mention "blog" is never eaten.
//   2. Only if step 1 actually stripped something, and what remains starts
//      with a bare <h1>, additionally check whether that heading's text
//      loosely matches (first few normalised words) the post's own title.
//      If so, strip the <h1> too. Gating the H1 strip on BOTH the nav-chrome
//      match AND the title match is what makes it safe: a post with no
//      nav-chrome ahead of it is never touched (an admin-authored post that
//      legitimately opens with its own heading keeps it), and even a
//      WP-imported post whose real body happens to open with an unrelated
//      <h1> is left alone (its text won't match the title).
const NAV_BLOG_LABEL = '[A-Za-z][A-Za-z ]{0,28}?blog';
const NAV_BLOG_ITEM = new RegExp(
  '^(?:' +
    `<p><a\\s+href="\\/category\\/[a-z0-9-]+-blog\\/"[^>]*>\\s*${NAV_BLOG_LABEL}\\s*<\\/a><\\/p>` + '|' +
    `<a\\s+href="\\/category\\/[a-z0-9-]+-blog\\/"[^>]*>\\s*${NAV_BLOG_LABEL}\\s*<\\/a>` + '|' +
    `<p>\\s*${NAV_BLOG_LABEL}\\s*<\\/p>` +
  ')\\s*',
  'i',
);
const LEADING_H1 = /^<h1(?:\s[^>]*)?>([\s\S]*?)<\/h1>\s*/i;
const MAX_NAV_ITEMS = 4; // observed max is 2 (Cosmetology + Dentistry); leaves headroom without going unbounded

/** Normalise HTML/text for a loose title comparison: strip tags, decode the
 *  handful of entities WordPress content carries, lower-case, drop punctuation. */
function normalizeForTitleMatch(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#8217;|&#8216;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#8212;|&mdash;/gi, '-')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripDuplicateWpChrome(html: string, title?: string): string {
  let s = html;
  let strippedNav = false;
  for (let i = 0; i < MAX_NAV_ITEMS; i++) {
    const m = NAV_BLOG_ITEM.exec(s);
    if (!m) break;
    s = s.slice(m[0].length);
    strippedNav = true;
  }
  if (!strippedNav) return html;
  const cleanTitle = title?.trim();
  if (cleanTitle) {
    const h1 = LEADING_H1.exec(s);
    if (h1) {
      // Compare only a word-prefix, not the whole (possibly long) title. Some
      // rows carry unrelated mojibake later in the heading — a separate,
      // pre-existing encoding defect from the same import, out of scope here —
      // which would break an exact whole-title match on a row the nav-chrome
      // match has already shown to be WordPress-import pollution. The shortest
      // live journal title is 5 words, so the prefix is the full 5 in practice.
      const words = (x: string) => normalizeForTitleMatch(x).split(' ').filter(Boolean);
      const h1Words = words(h1[1]);
      const titleWords = words(cleanTitle);
      const n = Math.min(5, titleWords.length);
      if (n > 0 && h1Words.slice(0, n).join(' ') === titleWords.slice(0, n).join(' ')) {
        s = s.slice(h1[0].length);
      }
    }
  }
  return s;
}

const articleCard = (a: Article): BlogCard => ({ slug: a.slug, title: a.title, excerpt: a.excerpt, category: a.category, readMinutes: a.readMinutes, published: a.published, image: articleImage(a.slug) });
const articlePost = (a: Article): BlogPost => ({ slug: a.slug, title: a.title, excerpt: a.excerpt, metaDescription: a.metaDescription, category: a.category, readMinutes: a.readMinutes, published: a.published, updated: a.updated, html: blocksToHtml(a.blocks), keywords: a.keywords, related: a.related ?? [], image: articleImage(a.slug) });

/** Published cards for the journal index: DB posts + any native article not overridden in the DB. */
export async function listBlogCards(): Promise<BlogCard[]> {
  let dbCards: BlogCard[] = [];
  let dbSlugs = new Set<string>();
  try {
    const rows = await db.post.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      select: { slug: true, title: true, excerpt: true, category: true, readMinutes: true, publishedAt: true, createdAt: true, coverImage: true },
    });
    dbCards = rows.map((r) => ({ slug: r.slug, title: r.title, excerpt: r.excerpt ?? '', category: r.category ?? 'Wellbeing', readMinutes: r.readMinutes, published: (r.publishedAt ?? r.createdAt).toISOString(), image: resolveMigratedImage(r.coverImage) }));
    dbSlugs = new Set(rows.map((r) => r.slug));
  } catch { /* Post table not migrated yet → native articles only */ }
  const staticCards = sortedArticles.filter((a) => !dbSlugs.has(a.slug)).map(articleCard);
  return [...dbCards, ...staticCards].sort((a, b) => +new Date(b.published) - +new Date(a.published));
}

/** A single published post (DB first, then native fallback). */
export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  try {
    const r = await db.post.findFirst({ where: { slug, status: 'PUBLISHED' } });
    if (r) return {
      slug: r.slug, title: r.title, excerpt: r.excerpt ?? '',
      metaDescription: r.metaDescription ?? (r.excerpt ? stripNavChrome(r.excerpt, r.title) : ''),
      category: r.category ?? 'Wellbeing', readMinutes: r.readMinutes, published: (r.publishedAt ?? r.createdAt).toISOString(),
      updated: r.updatedAt.toISOString(), html: stripDuplicateWpChrome(rewriteMigratedImageSrcs(sanitizeHtml(r.content)), r.title), keywords: r.keywords, related: r.related, image: resolveMigratedImage(r.coverImage),
    };
  } catch { /* fall through to native */ }
  const a = getArticle(slug);
  return a ? articlePost(a) : null;
}

export async function moreBlogCards(excludeSlug: string, n = 2): Promise<BlogCard[]> {
  const all = await listBlogCards();
  return all.filter((c) => c.slug !== excludeSlug).slice(0, n);
}

// ── Admin ───────────────────────────────────────────────────────────────────
export async function listAllPosts() {
  return db.post.findMany({
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    select: { id: true, slug: true, title: true, category: true, status: true, updatedAt: true, publishedAt: true, source: true },
  });
}
export async function getPostById(id: string) {
  return db.post.findUnique({ where: { id } });
}

export type EditablePost = {
  id: string; slug: string; title: string; excerpt: string | null; metaDescription: string | null;
  content: string; category: string | null; coverImage: string | null; readMinutes: number;
  keywords: string[]; related: string[]; status: 'DRAFT' | 'PUBLISHED';
};

/** Load a post for the block editor: its blocks (or imported HTML → blocks). */
export async function getPostForEdit(id: string): Promise<{ post: EditablePost; blocks: Block[] } | null> {
  const cols = { id: true, slug: true, title: true, excerpt: true, metaDescription: true, content: true, category: true, coverImage: true, readMinutes: true, keywords: true, related: true, status: true } as const;
  let p: EditablePost | null;
  let raw: unknown = null;
  try {
    const full = await db.post.findUnique({ where: { id } });
    if (full) raw = (full as { blocks?: unknown }).blocks ?? null;
    p = full as EditablePost | null;
  } catch {
    // `blocks` column not migrated yet → read the rest and derive from HTML.
    p = (await db.post.findUnique({ where: { id }, select: cols })) as EditablePost | null;
  }
  if (!p) return null;
  const blocks: Block[] = asBlocks(raw) ?? htmlToBlocks(p.content);
  return { post: p, blocks };
}
