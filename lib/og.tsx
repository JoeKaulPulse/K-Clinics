import fs from 'node:fs';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { K_BADGE_B64 } from '@/lib/brand-email-assets';

// Shared Open Graph card renderer — branded 1200×630 cards for any page.
// Built at build time (Node, force-static) so fs + bundled fonts are available.
export const ogSize = { width: 1200, height: 630 };
export const ogContentType = 'image/png';

// Brand fonts, read once. Fraunces = display (headings); Geist = sans (labels).
const fontFile = (p: string) => { try { return fs.readFileSync(path.join(process.cwd(), p)); } catch { return null; } };
const FRAUNCES = fontFile('assets/fonts/Fraunces-SemiBold.ttf');
const FRAUNCES_ITALIC = fontFile('assets/fonts/Fraunces-Italic.ttf');
const GEIST = fontFile('node_modules/geist/dist/fonts/geist-sans/Geist-Medium.ttf');

const BADGE = `data:image/png;base64,${K_BADGE_B64}`;

export function renderOg({ eyebrow, title, accent = 'perfected.' }: { eyebrow: string; title: string; accent?: string }) {
  const fonts = [
    FRAUNCES && { name: 'Fraunces', data: FRAUNCES, weight: 600 as const, style: 'normal' as const },
    FRAUNCES_ITALIC && { name: 'FrauncesItalic', data: FRAUNCES_ITALIC, weight: 400 as const, style: 'normal' as const },
    GEIST && { name: 'Geist', data: GEIST, weight: 500 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: Buffer; weight: 400 | 500 | 600; style: 'normal' }[];

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
          fontFamily: 'Geist',
        }}
      >
        {/* Brand mark + wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BADGE} width={68} height={68} alt="" style={{ borderRadius: 14 }} />
          <div style={{ fontFamily: 'Fraunces', fontSize: 30, letterSpacing: 6 }}>K CLINICS</div>
        </div>

        {/* Headline */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontFamily: 'Geist', fontSize: 22, letterSpacing: 5, textTransform: 'uppercase', color: '#dcc4a8' }}>
            {eyebrow}
          </div>
          <div style={{ marginTop: 20, fontFamily: 'Fraunces', fontSize: title.length > 40 ? 64 : 78, lineHeight: 1.04, letterSpacing: -1, maxWidth: 1000 }}>
            {title}
          </div>
          <div style={{ marginTop: 26, fontFamily: 'FrauncesItalic', fontSize: 32, color: '#c2a589' }}>
            {accent}
          </div>
          <div style={{ marginTop: 10, fontFamily: 'Geist', fontSize: 22, color: 'rgba(248,241,236,0.65)' }}>
            Aesthetics · Dentistry — Islington, London
          </div>
        </div>

        {/* Gold hairline accent */}
        <div style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', height: 8, backgroundImage: 'linear-gradient(90deg,#a98a6d,#dcc4a8,#a98a6d)' }} />
      </div>
    ),
    { ...ogSize, ...(fonts.length ? { fonts } : {}) },
  );
}
