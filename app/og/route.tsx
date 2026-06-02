import { ImageResponse } from 'next/og';
import { site } from '@/lib/site';

// Dynamic, per-page Open Graph / social card. Every page points its OG + Twitter
// image here with its own title/description (see lib/seo.tsx → pageMeta), so each
// shared link previews with a unique, on-brand 1200×630 card instead of one
// generic site-wide image. Rendered on the edge and cached hard.
export const runtime = 'edge';

const clip = (s: string | null, n: number) => (s || '').replace(/\s+/g, ' ').trim().slice(0, n);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = clip(searchParams.get('title'), 110) || 'Aesthetics & dentistry, perfected.';
  const eyebrow = clip(searchParams.get('eyebrow'), 48) || `${site.name} · London`;
  const tag = clip(searchParams.get('tag'), 150) || 'Laser & skin · Non-surgical lifting · Aesthetic dentistry — Islington, London';

  return new ImageResponse(
    (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 80,
          backgroundColor: '#2a2420',
          backgroundImage: 'radial-gradient(120% 120% at 80% -10%, rgba(169,138,109,0.38), rgba(42,36,32,0) 55%)',
          color: '#f6ece3',
          fontFamily: 'serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 999,
              border: '2px solid #a98a6d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 34,
            }}
          >
            K
          </div>
          <div style={{ fontSize: 28, letterSpacing: 1, color: 'rgba(248,241,236,0.86)' }}>{eyebrow}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: title.length > 60 ? 58 : 72, lineHeight: 1.06, letterSpacing: -1, color: '#f6ece3' }}>
            {title}
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 28,
              fontSize: 25,
              fontFamily: 'sans-serif',
              color: 'rgba(248,241,236,0.72)',
            }}
          >
            {tag}
          </div>
        </div>

        <div style={{ display: 'flex', height: 8, width: 180, backgroundColor: '#dcc4a8', borderRadius: 999 }} />
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { 'cache-control': 'public, immutable, no-transform, max-age=31536000' },
    },
  );
}
