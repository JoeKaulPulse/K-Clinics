import { site } from '@/lib/site';
import { KMark, ClinicsWordmark } from '@/components/brand/marks';

/**
 * K Clinics logo — official artwork, rendered as inline SVG.
 *  • Desktop (sm+): the "K" swoosh monogram stacked ABOVE the "CLINICS" wordmark.
 *  • Mobile (<sm):  an oversized, signature "K" that overhangs the nav bar,
 *    self-draws on load, and fills with champagne gold on tap / hover.
 *
 * Both sizes carry a persistent champagne shimmer — a gold copy of the K masked
 * by a slow sweeping highlight (clipped to the K shape).
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
      {/* Mobile: oversized signature K. Overhangs the bar; self-draws on load;
          gold "ink" rises on tap/hover; persistent shimmer sweeps across. */}
      <span aria-hidden className="logo-k group sm:hidden">
        <span className="absolute inset-0">
          <KMark animated />
        </span>
        {/* Gold ink-rise (interaction) */}
        <span className="logo-k__rise absolute inset-0 text-[var(--color-gold)]">
          <KMark />
        </span>
        {/* Persistent shimmer (always-on sweep) */}
        <span className="k-shimmer absolute inset-0 text-[var(--color-gold-bright)]">
          <KMark />
        </span>
      </span>

      {/* Desktop: the formal stacked lockup, with a shimmering K. */}
      <span aria-hidden className="hidden flex-col items-center sm:flex">
        <span className="relative block h-9 w-5">
          <KMark />
          <span className="k-shimmer absolute inset-0 text-[var(--color-gold-bright)]">
            <KMark />
          </span>
        </span>
        <span className="mt-2 block h-[0.6rem] w-[6.75rem]">
          <ClinicsWordmark />
        </span>
      </span>

      <span className="sr-only">{site.name}</span>
    </span>
  );
}
