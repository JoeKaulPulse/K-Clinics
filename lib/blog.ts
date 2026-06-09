import 'server-only';
import { db } from './db';
import { sortedArticles, getArticle, type Article, type ArticleBlock } from './articles';
import { articleImage } from './treatment-images';
import { asBlocks, htmlToBlocks, type Block } from './blocks';
import { sanitizeHtml } from './sanitize';

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
    dbCards = rows.map((r) => ({ slug: r.slug, title: r.title, excerpt: r.excerpt ?? '', category: r.category ?? 'Wellbeing', readMinutes: r.readMinutes, published: (r.publishedAt ?? r.createdAt).toISOString(), image: r.coverImage ?? null }));
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
      slug: r.slug, title: r.title, excerpt: r.excerpt ?? '', metaDescription: r.metaDescription ?? r.excerpt ?? '',
      category: r.category ?? 'Wellbeing', readMinutes: r.readMinutes, published: (r.publishedAt ?? r.createdAt).toISOString(),
      updated: r.updatedAt.toISOString(), html: sanitizeHtml(r.content), keywords: r.keywords, related: r.related, image: r.coverImage ?? null,
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
