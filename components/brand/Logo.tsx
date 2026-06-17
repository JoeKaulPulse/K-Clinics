import { site } from '@/lib/site';
import { KMark, ClinicsWordmark } from '@/components/brand/marks';

/**
 * KClinics logo — a SINGLE "K" monogram above the CLINICS wordmark.
 *
 * Deliberately one inline SVG (one path), so it can never double-render. The
 * "animation" is a smooth gold colour fill on hover (handled in CSS via the
 * `.logo` class) — no overlaid second copy, no self-draw stroke in the header.
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
  const kBox = size === 'footer' ? 'h-12 w-[1.65rem]' : 'h-10 w-[1.4rem]';
  const wordmark = size === 'footer' ? 'h-[0.7rem] w-[8rem]' : 'h-[0.58rem] w-[6.5rem]';

  return (
    <span
      className={`logo group inline-flex flex-col items-center gap-2.5 leading-none ${className}`}
      style={{ color }}
      aria-label={site.name}
    >
      <span aria-hidden className={`logo__k block ${kBox}`}>
        <KMark />
      </span>
      <span aria-hidden className={`block ${wordmark}`}>
        <ClinicsWordmark />
      </span>
      <span className="sr-only">{site.name}</span>
    </span>
  );
}
