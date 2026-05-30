import { site } from '@/lib/site';
import { KMark, ClinicsWordmark } from '@/components/brand/marks';

/**
 * K Clinics logo — official artwork, rendered as inline SVG.
 *  • Desktop (sm+): the "K" swoosh monogram stacked ABOVE the "CLINICS" wordmark.
 *  • Mobile (<sm):  the "K" swoosh monogram only.
 *
 * Colour follows `currentColor`, so it flips to porcelain over dark heroes and
 * brand taupe / ink on light surfaces. Artwork in components/brand/marks.tsx.
 *
 * Aspect ratios from source SVGs:
 *   K mark        — 130 × 234 (tall portrait swoosh)
 *   CLINICS mark  — 531 × 51  (wide wordmark, no strapline)
 */
export function Logo({ className = '', mono = false }: { className?: string; mono?: boolean }) {
  const color = mono ? 'var(--color-porcelain)' : 'var(--color-fg)';

  return (
    <span
      className={`inline-flex flex-col items-center leading-none ${className}`}
      style={{ color }}
      aria-label={site.name}
    >
      {/* K swoosh — always visible. Tall portrait: height-driven sizing. */}
      <span aria-hidden className="block h-8 w-[1.1rem] sm:h-9 sm:w-5">
        <KMark />
      </span>
      {/* CLINICS wordmark — desktop only, stacked beneath. Wide: width-driven. */}
      <span aria-hidden className="mt-2 hidden h-[0.6rem] w-[6.75rem] sm:block">
        <ClinicsWordmark />
      </span>
      <span className="sr-only">{site.name}</span>
    </span>
  );
}
