import fs from 'node:fs';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { qrPngDataUrl } from '@/lib/qr';
import { site } from '@/lib/site';

export const runtime = 'nodejs';
// Dynamic (DB lookup per result) but CDN-cacheable: the card for a result never
// changes, so an hour of shared cache keeps repeat shares free.
export const dynamic = 'force-dynamic';

// Branded 1080×1350 (4:5 portrait — Instagram-native) share card. Scores +
// headline + QR to the public share page. NO client photo on the card (v1).
const WIDTH = 1080;
const HEIGHT = 1350;

// Brand palette.
const INK = '#2a2420';
const PORCELAIN = '#f6ece3';
const GOLD = '#a98a6d';
const GOLD_LIGHT = '#dcc4a8';

// Brand fonts, read once per instance (same pattern as lib/og.tsx).
const fontFile = (p: string) => { try { return fs.readFileSync(path.join(process.cwd(), p)); } catch { return null; } };
const FRAUNCES = fontFile('assets/fonts/Fraunces-SemiBold.ttf');
const FRAUNCES_ITALIC = fontFile('assets/fonts/Fraunces-Italic.ttf');
const GEIST = fontFile('node_modules/geist/dist/fonts/geist-sans/Geist-Medium.ttf');

const IG_HANDLE = '@' + (site.social.instagram.split('/').filter(Boolean).pop() || 'kclinics');

function ScoreRing({ label, score }: { label: string; score: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: 300,
          height: 300,
          borderRadius: 9999,
          border: `6px solid ${GOLD}`,
          backgroundColor: 'rgba(169,138,109,0.10)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <div style={{ display: 'flex', fontFamily: 'Fraunces', fontSize: 132, color: PORCELAIN, lineHeight: 1 }}>{score}</div>
          <div style={{ display: 'flex', fontFamily: 'Fraunces', fontSize: 44, color: GOLD_LIGHT, marginLeft: 6 }}>/10</div>
        </div>
      </div>
      <div style={{ display: 'flex', marginTop: 26, fontFamily: 'Geist', fontSize: 30, letterSpacing: 8, textTransform: 'uppercase', color: GOLD_LIGHT }}>
        {label}
      </div>
    </div>
  );
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await db.kioskResult.findUnique({
    where: { id },
    select: { headline: true, skinScore: true, smileScore: true, shareSlug: true },
  });
  if (!result) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

  const shareUrl = `${site.url.replace(/\/$/, '')}/kiosk/result/${result.shareSlug}`;
  const qr = await qrPngDataUrl(shareUrl, { dark: INK, light: '#ffffff' });

  const fonts = [
    FRAUNCES && { name: 'Fraunces', data: FRAUNCES, weight: 600 as const, style: 'normal' as const },
    FRAUNCES_ITALIC && { name: 'FrauncesItalic', data: FRAUNCES_ITALIC, weight: 400 as const, style: 'normal' as const },
    GEIST && { name: 'Geist', data: GEIST, weight: 500 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: Buffer; weight: 400 | 500 | 600; style: 'normal' }[];

  const headlineSize = result.headline.length > 44 ? 56 : result.headline.length > 28 ? 68 : 80;

  return new ImageResponse(
    (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '88px 80px 72px',
          backgroundColor: INK,
          color: PORCELAIN,
          fontFamily: 'Geist',
          overflow: 'hidden',
        }}
      >
        {/* Gold shimmer wash */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: WIDTH,
            height: HEIGHT,
            backgroundImage:
              `radial-gradient(90% 60% at 50% -12%, rgba(169,138,109,0.42), rgba(42,36,32,0) 60%),` +
              `radial-gradient(70% 40% at 50% 112%, rgba(169,138,109,0.22), rgba(42,36,32,0) 55%)`,
          }}
        />

        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
          <div style={{ display: 'flex', fontFamily: 'Geist', fontSize: 30, letterSpacing: 12, textTransform: 'uppercase', color: GOLD_LIGHT }}>
            Skin &amp; Smile
          </div>
          <div style={{ display: 'flex', height: 4, width: 120, backgroundImage: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})`, borderRadius: 999, marginTop: 22 }} />
          <div
            style={{
              display: 'flex',
              marginTop: 46,
              fontFamily: 'Fraunces',
              fontSize: headlineSize,
              lineHeight: 1.08,
              letterSpacing: -1,
              color: PORCELAIN,
              textAlign: 'center',
              maxWidth: 880,
            }}
          >
            {result.headline}
          </div>
        </div>

        {/* Scores */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 96, position: 'relative' }}>
          <ScoreRing label="Skin" score={result.skinScore} />
          <ScoreRing label="Smile" score={result.smileScore} />
        </div>

        {/* QR + footer */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#ffffff',
              borderRadius: 28,
              padding: 26,
              boxShadow: '0 18px 50px rgba(0,0,0,0.45)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} width={190} height={190} alt="" style={{ width: 190, height: 190 }} />
            <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 30, maxWidth: 360 }}>
              <div style={{ display: 'flex', fontFamily: 'Fraunces', fontSize: 36, color: INK, lineHeight: 1.15 }}>
                See my full glow-up
              </div>
              <div style={{ display: 'flex', marginTop: 12, fontFamily: 'Geist', fontSize: 22, color: GOLD, letterSpacing: 1 }}>
                Scan for the result
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', marginTop: 52, fontFamily: 'Geist', fontSize: 28, letterSpacing: 6, textTransform: 'uppercase', color: PORCELAIN }}>
            K CLINICS — ISLINGTON, LONDON
          </div>
          <div style={{ display: 'flex', marginTop: 16, fontFamily: 'FrauncesItalic', fontSize: 28, color: GOLD_LIGHT }}>
            {IG_HANDLE}
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      ...(fonts.length ? { fonts } : {}),
      headers: {
        'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    },
  );
}
