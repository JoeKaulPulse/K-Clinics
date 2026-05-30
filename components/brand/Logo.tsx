import { site } from '@/lib/site';
import { KMark, ClinicsWordmark } from '@/components/brand/marks';

/**
 * K Clinics logo — rendered as inline SVG content.
 *  • Desktop (sm+): the "K" mark stacked ABOVE the "CLINICS" wordmark.
 *  • Mobile (<sm):  the "K" mark only.
 *
 * Colour follows `currentColor`, so it flips to porcelain over dark heroes and
 * ink on light surfaces. Real artwork lives in components/brand/marks.tsx.
 */
export function Logo({ className = '', mono = false }: { className?: string; mono?: boolean }) {
  const color = mono ? 'var(--color-porcelain)' : 'var(--color-fg)';

  return (
    <span
      className={`inline-flex flex-col items-center leading-none ${className}`}
      style={{ color }}
      aria-label={site.name}
    >
      {/* K mark — always visible */}
      <span aria-hidden className="block h-9 w-9 sm:h-11 sm:w-11">
        <KMark />
      </span>
      {/* CLINICS wordmark — desktop only, stacked beneath the K */}
      <span aria-hidden className="mt-2 hidden h-[0.6rem] w-[7.25rem] sm:block">
        <ClinicsWordmark />
      </span>
      <span className="sr-only">{site.name}</span>
    </span>
  );
}
