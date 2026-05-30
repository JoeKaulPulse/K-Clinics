// ─────────────────────────────────────────────────────────────────────────────
// Headless WordPress integration.
//
// The Next.js front-end reads content from a WordPress backend via the REST API
// (wp/v2). To keep the static demo working WITHOUT a live WP instance, every
// fetch falls back to the local content in lib/treatments.ts etc.
//
// To go live with WordPress:
//   1. Stand up WordPress (any host) with the REST API enabled (default).
//   2. Set WORDPRESS_API_URL, e.g. https://cms.kclinics.co.uk/wp-json
//   3. (Recommended) install ACF + "ACF to REST API", or WPGraphQL, to expose
//      the treatment fields (tagline, benefits, faqs, …). Map them in
//      `mapTreatmentPost()` below.
// ─────────────────────────────────────────────────────────────────────────────

import { treatments as localTreatments, type Treatment } from './treatments';

const WP_API = process.env.WORDPRESS_API_URL?.replace(/\/$/, '') ?? '';
export const wordpressEnabled = Boolean(WP_API);

type WPRendered = { rendered: string };
type WPPost = {
  id: number;
  slug: string;
  title: WPRendered;
  excerpt: WPRendered;
  content: WPRendered;
  acf?: Record<string, unknown>;
  _embedded?: { 'wp:featuredmedia'?: { source_url: string; alt_text?: string }[] };
};

const strip = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&hellip;/g, '…')
    .replace(/&#8217;/g, '’')
    .replace(/&amp;/g, '&')
    .trim();

/** Low-level fetch with ISR. Returns null on any failure so callers can fall back. */
async function wpFetch<T>(path: string, revalidate = 300): Promise<T | null> {
  if (!wordpressEnabled) return null;
  try {
    const res = await fetch(`${WP_API}${path}`, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Maps a WP post (+ ACF fields) onto our Treatment shape, merging over the
 *  local default so partial CMS data still renders a complete page. */
function mapTreatmentPost(post: WPPost, fallback?: Treatment): Treatment | null {
  const base = fallback ?? localTreatments.find((t) => t.slug === post.slug);
  if (!base) return null;
  const acf = post.acf ?? {};
  const get = <T,>(key: string, def: T): T => (acf[key] != null ? (acf[key] as T) : def);

  return {
    ...base,
    title: strip(post.title?.rendered) || base.title,
    tagline: get('tagline', base.tagline),
    intro: post.content?.rendered ? strip(post.content.rendered) : base.intro,
    metaTitle: get('meta_title', base.metaTitle),
    metaDescription: post.excerpt?.rendered ? strip(post.excerpt.rendered) : base.metaDescription,
    benefits: get('benefits', base.benefits),
    process: get('process', base.process),
    faqs: get('faqs', base.faqs),
    facts: get('facts', base.facts),
    priceFrom: get('price_from', base.priceFrom),
  };
}

// ── Public API (used by pages). Each returns CMS data when configured, else
//    the curated local content — so the build is always complete. ────────────

export async function getTreatments(): Promise<Treatment[]> {
  const posts = await wpFetch<WPPost[]>('/wp/v2/treatment?per_page=100&_embed');
  if (!posts?.length) return localTreatments;
  const mapped = posts.map((p) => mapTreatmentPost(p)).filter(Boolean) as Treatment[];
  return mapped.length ? mapped : localTreatments;
}

export async function getTreatmentBySlug(slug: string): Promise<Treatment | undefined> {
  const local = localTreatments.find((t) => t.slug === slug);
  const posts = await wpFetch<WPPost[]>(`/wp/v2/treatment?slug=${encodeURIComponent(slug)}&_embed`);
  if (posts?.[0]) return mapTreatmentPost(posts[0], local) ?? local;
  return local;
}

/** Detects whether the configured backend is reachable + reports its identity. */
export async function getBackendInfo() {
  if (!wordpressEnabled) return { connected: false as const, source: 'local' as const };
  const root = await wpFetch<{ name?: string; description?: string }>('/', 60);
  return root
    ? { connected: true as const, source: 'wordpress' as const, name: root.name, description: root.description }
    : { connected: false as const, source: 'local' as const };
}
