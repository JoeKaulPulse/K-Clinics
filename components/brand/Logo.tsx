import { site } from '@/lib/site';
import { KMark, ClinicsWordmark } from '@/components/brand/marks';

/**
 * K Clinics logo — official artwork, rendered as inline SVG.
 *
 * ONE animated "K" at every breakpoint (no duplicate/static copy): the monogram
 * self-draws on load and fills with champagne gold on hover. The CLINICS
 * wordmark sits beneath on larger screens. Sizing is controlled by `size`.
 *
 * Colour follows `currentColor`, so it flips to porcelain over dark heroes and
 * brand taupe / ink on light surfaces.
 */
export function Logo({
  className = '',
  mono = false,
  size = 'header',
}: {
  className?: string;
  mono?: boolean;
  size?: 'header' | 'footer';
}) {
  const color = mono ? 'var(--color-porcelain)' : 'var(--color-fg)';
  // K box dimensions (the swoosh is a tall 130×234 portrait).
  const kBox = size === 'footer' ? 'h-12 w-[1.65rem]' : 'h-10 w-[1.4rem]';
  const wordmark = size === 'footer' ? 'h-[0.7rem] w-[8rem]' : 'h-[0.58rem] w-[6.5rem]';

  return (
    <span
      className={`logo group inline-flex flex-col items-center gap-2.5 leading-none ${className}`}
      style={{ color }}
      aria-label={site.name}
    >
      {/* The single animated K. Base draws in on load; a clipped gold copy rises
          on hover (invisible at rest, so it never ghosts). */}
      <span aria-hidden className={`relative block ${kBox}`}>
        <span className="absolute inset-0">
          <KMark animated />
        </span>
        <span className="logo__rise absolute inset-0 text-[var(--color-gold)]">
          <KMark />
        </span>
      </span>

      {/* CLINICS wordmark — beneath the K (hidden on the smallest screens). */}
      <span aria-hidden className={`hidden sm:block ${wordmark}`}>
        <ClinicsWordmark />
      </span>

      <span className="sr-only">{site.name}</span>
    </span>
  );
}
