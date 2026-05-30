import { ImageResponse } from 'next/og';
import { site } from '@/lib/site';

// Generated at build time (Node) so it works in a static export for GitHub Pages.
export const dynamic = 'force-static';
export const alt = `${site.name} — ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OG() {
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
          backgroundColor: '#2b1d24',
          backgroundImage:
            'radial-gradient(120% 120% at 80% -10%, rgba(176,133,68,0.35), rgba(43,29,36,0) 55%)',
          color: '#f8f1ec',
          fontFamily: 'serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 999,
              border: '2px solid #b08544',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 34,
            }}
          >
            K
          </div>
          <div style={{ fontSize: 30, letterSpacing: 1 }}>K Clinics · London</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 76, lineHeight: 1.05, letterSpacing: -1 }}>
            Aesthetics & dentistry,
          </div>
          <div style={{ fontSize: 76, lineHeight: 1.05, color: '#e3c98f', letterSpacing: -1 }}>
            perfected.
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 26,
              fontFamily: 'sans-serif',
              color: 'rgba(248,241,236,0.72)',
            }}
          >
            Laser & skin · Non-surgical lifting · Aesthetic dentistry — Islington, London
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
