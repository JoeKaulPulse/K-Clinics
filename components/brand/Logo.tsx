import { site } from '@/lib/site';
import { KMark, ClinicsWordmark } from '@/components/brand/marks';

/**
 * K Clinics logo — official artwork, rendered as inline SVG.
 *  • Desktop (sm+): the "K" swoosh monogram stacked ABOVE the "CLINICS" wordmark.
 *  • Mobile (<sm):  an oversized, signature "K" that overhangs the nav bar,
 *    self-draws on load, and fills with champagne gold on tap / hover.
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
      {/* Mobile: oversized signature K. Overhangs the bar; self-draws on load;
          gold "ink" rises through it on tap / hover. */}
      <span aria-hidden className="logo-k group sm:hidden">
        {/* Base mark — draws itself in on first load */}
        <span className="absolute inset-0">
          <KMark animated />
        </span>
        {/* Gold overlay, clipped — rises to fill the K on interaction */}
        <span className="logo-k__rise absolute inset-0 text-[var(--color-gold)]">
          <KMark />
        </span>
      </span>

      {/* Desktop: the formal stacked lockup. */}
      <span aria-hidden className="hidden flex-col items-center sm:flex">
        <span className="block h-9 w-5">
          <KMark />
        </span>
        <span className="mt-2 block h-[0.6rem] w-[6.75rem]">
          <ClinicsWordmark />
        </span>
      </span>

      <span className="sr-only">{site.name}</span>
    </span>
  );
}
