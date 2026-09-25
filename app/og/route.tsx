import { site } from '@/lib/site';
import { renderOg } from '@/lib/og';

// Dynamic, per-page Open Graph / social card. Every page points its OG + Twitter
// image here with its own title/description (see lib/seo.tsx → pageMeta), so each
// shared link previews with a unique, on-brand 1200×630 card. Runs in Node so it
// shares the renderer (bundled brand fonts + the K mark/wordmark); the optional
// `img` background photo is fetched at runtime when not on the local disk.
export const runtime = 'nodejs';

// PRJ-1229.11: hard-slicing at `n` chars could land mid-word ("...design-led
// cl"). `ellipsis` truncates at the last word boundary before the limit and
// appends "…" instead — only for human-readable text, never for the `img`
// path (its regex check below expects an exact filename, not "…").
const clip = (s: string | null, n: number, ellipsis = false) => {
  const t = (s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  if (!ellipsis) return t.slice(0, n);
  const sliced = t.slice(0, n);
  const lastSpace = sliced.lastIndexOf(' ');
  return `${lastSpace > 0 ? sliced.slice(0, lastSpace) : sliced}…`;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = clip(searchParams.get('title'), 110, true) || `${site.name} — aesthetics & skin, reimagined`;
  const eyebrow = clip(searchParams.get('eyebrow'), 48, true) || `${site.name} · London`;
  const tag = clip(searchParams.get('tag'), 150, true);
  // Only allow our own /treatments and /hero photography as backgrounds.
  const rawImg = clip(searchParams.get('img'), 200);
  const img = /^\/(treatments|hero)\/[\w.-]+\.(jpe?g|png|webp|avif)$/i.test(rawImg) ? rawImg : null;

  // BLD-1683: this route renders per-request (unlike the three force-static OG
  // routes), so it can read the real admin-toggleable flag instead of falling
  // through to renderOg's static-constant default.
  const { getSiteConfig } = await import('@/lib/site-config');
  const { dentistryLive } = await getSiteConfig(); // falls back to safe static defaults internally on any DB error

  const res = renderOg({ eyebrow, title, tag: tag || undefined, image: img, dentistryLive });
  res.headers.set('cache-control', 'public, immutable, no-transform, max-age=31536000');
  return res;
}
