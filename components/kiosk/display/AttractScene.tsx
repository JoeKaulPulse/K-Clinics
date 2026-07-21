// Attract loop: dark ink canvas, slow gold shimmer, drifting dots, three
// rotating Fraunces value lines (pure-CSS 18s crossfade cycle), breathing QR
// card and the "New code in mm:ss" regen countdown. Portrait stacks
// vertically; landscape splits copy left / QR right.
//
// BLD-137: seasonal themes override the value lines and tagline via the
// THEME_COPY map — add new themes there to extend.

import type { KioskThemeKey } from '@/lib/kiosk-themes';
import type { ReactNode } from 'react';
import { KMark, ClinicsWordmark } from '@/components/brand/marks';

type ThemeCopy = {
  tagline: string;
  lines: ReactNode[];
  cta: string;
};

const DEFAULT_LINES: ReactNode[] = [
  <>Discover your <span className="text-gold-shimmer">skin &amp; smile</span> score</>,
  <>Sixty seconds of <span className="text-gold-shimmer">pure glow</span></>,
  <>Real compliments, <span className="text-gold-shimmer">read by AI</span></>,
];

const THEME_COPY: Record<KioskThemeKey, ThemeCopy> = {
  default: {
    tagline: 'Skin & Smile',
    lines: DEFAULT_LINES,
    cta: 'Point your camera at the code — it takes about a minute.',
  },
  christmas: {
    tagline: 'Festive Glow',
    lines: [
      <>Glow into the <span className="text-gold-shimmer">festive season</span></>,
      <>Your most radiant <span className="text-gold-shimmer">Christmas yet</span></>,
      <>Real compliments, <span className="text-gold-shimmer">read by AI</span></>,
    ],
    cta: 'Point your camera at the code — a little festive magic takes a minute.',
  },
  valentines: {
    tagline: 'Love Your Skin',
    lines: [
      <>A little love for <span className="text-gold-shimmer">your skin</span></>,
      <>Your glow, <span className="text-gold-shimmer">your gift</span></>,
      <>Real compliments, <span className="text-gold-shimmer">read by AI</span></>,
    ],
    cta: 'Point your camera at the code — it takes about a minute.',
  },
  summer: {
    tagline: 'Summer Skin',
    lines: [
      <>Summer skin <span className="text-gold-shimmer">starts here</span></>,
      <>Your brightest <span className="text-gold-shimmer">summer yet</span></>,
      <>Real compliments, <span className="text-gold-shimmer">read by AI</span></>,
    ],
    cta: 'Point your camera at the code — sixty sunny seconds.',
  },
};

export function AttractScene({ svg, remainingMs, theme = 'default' }: { svg: string; remainingMs: number; theme?: KioskThemeKey }) {
  const mins = Math.max(0, Math.floor(remainingMs / 60000));
  const secs = Math.max(0, Math.floor((remainingMs % 60000) / 1000));
  const copy = THEME_COPY[theme] ?? THEME_COPY.default;

  return (
    <div className="kd-attract">
      {/* Copy block */}
      <div className="flex w-full max-w-[88vmin] flex-col gap-[2.5vmin] portrait:items-center landscape:items-start landscape:max-w-none landscape:self-center">
        {/* Brand rule: the supplied logo mark stands as the identity — the
            seasonal descriptor follows it as text, never the brand name. */}
        <div className="flex items-center gap-[1.6vmin] text-[var(--color-gold-soft)] portrait:justify-center">
          <span className="inline-flex items-center gap-[1vmin]" aria-label="KClinics">
            <span className="block h-[4vmin] w-[2.2vmin]"><KMark /></span>
            <span className="block h-[1.6vmin] w-[16vmin]"><ClinicsWordmark /></span>
          </span>
          <span aria-hidden className="text-[clamp(1rem,1.7vmin,1.4rem)] opacity-50">·</span>
          <span className="font-[family-name:var(--font-display)] text-[clamp(1rem,2vmin,1.6rem)] uppercase tracking-[0.4em]">
            {copy.tagline}
          </span>
        </div>
        <div className="kd-lines h-[34vmin] landscape:h-[36vmin]">
          {copy.lines.map((line, i) => (
            <h1
              key={i}
              className="kd-line font-[family-name:var(--font-display)] text-[clamp(2.6rem,9vmin,7.5rem)] leading-[1.04] tracking-[-0.02em] text-[var(--color-porcelain)]"
            >
              <span>{line}</span>
            </h1>
          ))}
        </div>
        <p className="text-[clamp(1rem,2.2vmin,1.7rem)] text-[var(--color-blush)]">
          {copy.cta}
        </p>
      </div>

      {/* Breathing QR */}
      <div className="relative flex items-center justify-center portrait:py-[3vmin]">
        <div className="relative">
          <div className="kd-qr-halo" aria-hidden />
          <div className="kd-qr-card">
            <div
              className="h-[min(48vmin,30rem)] w-[min(48vmin,30rem)]"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
        </div>
      </div>

      {/* Footer line */}
      <div className="flex flex-col items-center gap-[0.8vmin] landscape:col-span-2 landscape:flex-row landscape:justify-between landscape:gap-0">
        <p className="text-[clamp(0.75rem,1.5vmin,1.1rem)] uppercase tracking-[0.3em] text-[rgba(246,236,227,0.45)]">
          Free &middot; Private &middot; 18+
        </p>
        <p className="text-[clamp(0.75rem,1.5vmin,1.1rem)] tabular-nums text-[rgba(246,236,227,0.45)]">
          New code in {mins}:{secs.toString().padStart(2, '0')}
        </p>
      </div>
    </div>
  );
}
