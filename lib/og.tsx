import { ImageResponse } from 'next/og';

// Shared Open Graph card renderer — branded 1200×630 cards for any page.
// Built at build time (Node) so it works in static export.
export const ogSize = { width: 1200, height: 630 };
export const ogContentType = 'image/png';

export function renderOg({ eyebrow, title, accent = 'perfected.' }: { eyebrow: string; title: string; accent?: string }) {
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
          backgroundImage: 'radial-gradient(120% 120% at 80% -10%, rgba(169,138,109,0.35), rgba(42,36,32,0) 55%)',
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
          <div style={{ fontSize: 28, letterSpacing: 1 }}>K Clinics · London</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 24, fontFamily: 'sans-serif', letterSpacing: 4, textTransform: 'uppercase', color: '#dcc4a8' }}>
            {eyebrow}
          </div>
          <div style={{ marginTop: 18, fontSize: title.length > 40 ? 60 : 74, lineHeight: 1.05, letterSpacing: -1, maxWidth: 1000 }}>
            {title}
          </div>
          <div style={{ marginTop: 24, fontSize: 24, fontFamily: 'sans-serif', color: 'rgba(248,241,236,0.7)' }}>
            {`Islington, London · ${accent}`}
          </div>
        </div>
      </div>
    ),
    { ...ogSize },
  );
}
