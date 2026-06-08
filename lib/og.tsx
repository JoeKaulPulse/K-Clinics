import fs from 'node:fs';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { site } from '@/lib/site';
import { K_MARK_LIGHT_B64, K_WORDMARK_LIGHT_B64 } from '@/lib/brand-email-assets';

// Shared Open Graph card renderer — branded 1200×630 cards for any page.
// Editorial layout: a full-bleed treatment photograph under a brand ink scrim,
// with the real K mark + CLINICS wordmark, the Fraunces display face and the
// brand palette. Rendered in Node so we can embed bundled fonts + (at build
// time) the photo itself; at runtime the photo falls back to a fetched URL.
export const ogSize = { width: 1200, height: 630 };
export const ogContentType = 'image/png';

// Brand fonts, read once. Fraunces = display (headings); Geist = sans (labels).
const fontFile = (p: string) => { try { return fs.readFileSync(path.join(process.cwd(), p)); } catch { return null; } };
const FRAUNCES = fontFile('assets/fonts/Fraunces-SemiBold.ttf');
const FRAUNCES_ITALIC = fontFile('assets/fonts/Fraunces-Italic.ttf');
const GEIST = fontFile('node_modules/geist/dist/fonts/geist-sans/Geist-Medium.ttf');

const MARK = `data:image/png;base64,${K_MARK_LIGHT_B64}`;
const WORDMARK = `data:image/png;base64,${K_WORDMARK_LIGHT_B64}`;

// Resolve a public-relative image (e.g. "/treatments/x.jpg") to something an
// <img> can render: a base64 data URI when the file is on disk (build time), or
// the absolute site URL otherwise (so next/og fetches it at runtime).
function imageToSrc(image?: string | null): string | null {
  if (!image) return null;
  const rel = image.startsWith('/') ? image : `/${image}`;
  try {
    const buf = fs.readFileSync(path.join(process.cwd(), 'public', rel.replace(/^\//, '')));
    const mime = rel.endsWith('.png') ? 'image/png' : rel.endsWith('.webp') ? 'image/webp' : rel.endsWith('.avif') ? 'image/avif' : 'image/jpeg';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return `${site.url}${rel}`;
  }
}

const DESCRIPTOR = site.dentistryLive
  ? 'Aesthetics · Dentistry — Islington, London'
  : 'Aesthetics · Laser · Skin — Islington, London';

export function renderOg({
  eyebrow,
  title,
  accent,
  tag,
  image,
}: {
  eyebrow: string;
  title: string;
  /** Short italic line (a treatment's poetic promise). */
  accent?: string;
  /** Muted supporting line (a page's meta description). */
  tag?: string;
  /** Public-relative image path for the background photograph. */
  image?: string | null;
}) {
  const fonts = [
    FRAUNCES && { name: 'Fraunces', data: FRAUNCES, weight: 600 as const, style: 'normal' as const },
    FRAUNCES_ITALIC && { name: 'FrauncesItalic', data: FRAUNCES_ITALIC, weight: 400 as const, style: 'normal' as const },
    GEIST && { name: 'Geist', data: GEIST, weight: 500 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: Buffer; weight: 400 | 500 | 600; style: 'normal' }[];

  const bg = imageToSrc(image);
  const titleSize = title.length > 52 ? 60 : title.length > 34 ? 72 : 84;

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
          padding: 76,
          backgroundColor: '#1c1815',
          color: '#f6ece3',
          fontFamily: 'Geist',
          overflow: 'hidden',
        }}
      >
        {/* Full-bleed photograph */}
        {bg && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bg} width={1200} height={630} alt="" style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 630, objectFit: 'cover' }} />
        )}
        {/* Ink scrim — keeps text legible and on-brand over any photo (and is the
            full background when there's no photo). */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            backgroundImage: bg
              ? 'linear-gradient(102deg, rgba(24,20,17,0.95) 0%, rgba(24,20,17,0.86) 36%, rgba(24,20,17,0.42) 66%, rgba(24,20,17,0.12) 100%)'
              : 'radial-gradient(120% 120% at 82% -10%, rgba(169,138,109,0.40), rgba(28,24,21,0) 56%)',
          }}
        />

        {/* Brand lockup */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 66, height: 66, borderRadius: 999, border: '2px solid rgba(220,196,168,0.7)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={MARK} width={30} height={30} alt="" />
          </div>
          <div style={{ display: 'flex', fontFamily: 'Geist', fontSize: 27, letterSpacing: 1, color: 'rgba(248,241,236,0.9)' }}>{eyebrow}</div>
        </div>

        {/* Headline block */}
        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <div style={{ display: 'flex', fontFamily: 'Fraunces', fontSize: titleSize, lineHeight: 1.05, letterSpacing: -1, color: '#f8f1ec', maxWidth: 920 }}>
            {title}
          </div>
          {accent && (
            <div style={{ display: 'flex', marginTop: 24, fontFamily: 'FrauncesItalic', fontSize: 33, color: '#dcc4a8' }}>{accent}</div>
          )}
          {!accent && tag && (
            <div style={{ display: 'flex', marginTop: 24, fontFamily: 'Geist', fontSize: 24, color: 'rgba(248,241,236,0.74)', maxWidth: 860 }}>{tag}</div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginTop: 30 }}>
            <div style={{ display: 'flex', height: 6, width: 132, backgroundImage: 'linear-gradient(90deg,#a98a6d,#dcc4a8)', borderRadius: 999 }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={WORDMARK} height={26} alt="K Clinics" style={{ height: 26, opacity: 0.92 }} />
          </div>
          <div style={{ display: 'flex', marginTop: 18, fontFamily: 'Geist', fontSize: 19, letterSpacing: 1, color: 'rgba(248,241,236,0.6)' }}>{DESCRIPTOR}</div>
        </div>
      </div>
    ),
    { ...ogSize, ...(fonts.length ? { fonts } : {}) },
  );
}
