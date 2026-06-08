import { site } from '@/lib/site';
import { renderOg } from '@/lib/og';

// Dynamic, per-page Open Graph / social card. Every page points its OG + Twitter
// image here with its own title/description (see lib/seo.tsx → pageMeta), so each
// shared link previews with a unique, on-brand 1200×630 card. Runs in Node so it
// shares the renderer (bundled brand fonts + the K mark/wordmark); the optional
// `img` background photo is fetched at runtime when not on the local disk.
export const runtime = 'nodejs';

const clip = (s: string | null, n: number) => (s || '').replace(/\s+/g, ' ').trim().slice(0, n);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = clip(searchParams.get('title'), 110) || `${site.name} — aesthetics & skin, reimagined`;
  const eyebrow = clip(searchParams.get('eyebrow'), 48) || `${site.name} · London`;
  const tag = clip(searchParams.get('tag'), 150);
  // Only allow our own /treatments and /hero photography as backgrounds.
  const rawImg = clip(searchParams.get('img'), 200);
  const img = /^\/(treatments|hero)\/[\w.-]+\.(jpe?g|png|webp|avif)$/i.test(rawImg) ? rawImg : null;

  const res = renderOg({ eyebrow, title, tag: tag || undefined, image: img });
  res.headers.set('cache-control', 'public, immutable, no-transform, max-age=31536000');
  return res;
}
