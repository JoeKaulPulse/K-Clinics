import { site } from '@/lib/site';
import { KMark, ClinicsWordmark } from '@/components/brand/marks';

/**
 * K Clinics logo — official artwork, rendered as inline SVG.
 *  • Desktop (sm+): the "K" swoosh monogram stacked ABOVE the "CLINICS" wordmark,
 *    with a persistent champagne shimmer sweeping across the K.
 *  • Mobile (<sm):  an oversized, signature "K" that overhangs the nav bar,
 *    self-draws on load, fills with gold on tap/hover, and shimmers.
 *
 * Colour follows `currentColor`, so it flips to porcelain over dark heroes and
 * brand taupe / ink on light surfaces. Artwork in components/brand/marks.tsx.
 */
export function Logo({ className = '', mono = false }: { className?: string; mono?: boolean }) {
  const color = mono ? 'var(--color-porcelain)' : 'var(--color-fg)';

  return (
    <span
      className={`inline-flex flex-col items-center leading-none ${className}`}
      style={{ color }}
      aria-label={site.name}
    >
      {/* Mobile: oversized signature K. The base draws itself in on load; a gold
          copy rises on tap/hover; a shimmer copy sweeps continuously. All three
          layers share the same box so they sit perfectly aligned. */}
      <span aria-hidden className="logo-k group sm:hidden">
        <span className="logo-k__layer">
          <KMark animated />
        </span>
        <span className="logo-k__layer logo-k__rise text-[var(--color-gold)]">
          <KMark />
        </span>
        <span className="logo-k__layer k-shimmer text-[var(--color-gold-bright)]">
          <KMark />
        </span>
      </span>

      {/* Desktop: the formal stacked lockup. The K sits in a fixed box; the
          shimmer overlay is absolutely positioned to the SAME box so they
          register exactly (no double-image). */}
      <span aria-hidden className="hidden flex-col items-center sm:flex">
        <span className="relative block h-9 w-5">
          <span className="absolute inset-0"><KMark /></span>
          <span className="absolute inset-0 k-shimmer text-[var(--color-gold-bright)]"><KMark /></span>
        </span>
        <span className="mt-2 block h-[0.6rem] w-[6.75rem]">
          <ClinicsWordmark />
        </span>
      </span>

      <span className="sr-only">{site.name}</span>
    </span>
  );
}
