/**
 * Shared star-rating display. Renders five stars with an accurate fractional
 * fill (e.g. 4.8 ★) using a clip overlay — so an aggregate rating is shown
 * truthfully, never rounded up to a flattering 5. The star path sits within a
 * 0 0 20 20 viewBox (no overflow / warping).
 *
 * The fill carries a soft metallic top-gloss and a periodic specular shimmer
 * sweep — both clipped to the star shapes and gated on prefers-reduced-motion.
 * Highlights are white, so they read on both light and dark surfaces; the base
 * colour stays caller-controlled via `colorClass`.
 */
const STAR = 'M10 1l2.47 5.18 5.68.74-4.18 3.9 1.06 5.62L10 19.4 4.97 16.44l1.06-5.62-4.18-3.9 5.68-.74z';

// One star as a CSS mask (alpha channel), tiled 5× across the row so the gloss +
// shimmer overlays are clipped to exactly the five star shapes.
// The star must be filled WHITE: CSS mask-image uses luminance by default, where
// white = shown and black (the SVG path default) = hidden.
const STAR_MASK =
  "url(\"data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2020%2020'%3E%3Cpath%20fill='%23fff'%20d='M10%201l2.47%205.18%205.68.74-4.18%203.9%201.06%205.62L10%2019.4%204.97%2016.44l1.06-5.62-4.18-3.9%205.68-.74z'/%3E%3C/svg%3E\")";

export function Stars({
  rating = 5,
  size = 'h-4 w-4',
  className = '',
  colorClass = 'text-[var(--color-gold)]',
  trackClass = 'text-[color-mix(in_oklab,currentColor_22%,transparent)]',
  shimmer = true,
}: {
  rating?: number;
  size?: string;
  className?: string;
  colorClass?: string;
  trackClass?: string;
  /** Disable the animated sweep (e.g. dense lists). The gloss stays. */
  shimmer?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
  const mask = {
    WebkitMaskImage: STAR_MASK, maskImage: STAR_MASK,
    WebkitMaskSize: '20% 100%', maskSize: '20% 100%',
    WebkitMaskRepeat: 'repeat', maskRepeat: 'repeat',
  } as const;
  return (
    <span className={`relative inline-flex ${colorClass} ${className}`} role="img" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {/* Empty track */}
      <span className={`flex ${trackClass}`} aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => (
          <svg key={i} viewBox="0 0 20 20" className={size} fill="currentColor"><path d={STAR} /></svg>
        ))}
      </span>
      {/* Filled overlay, clipped to the rating */}
      <span className="absolute inset-0 flex overflow-hidden" style={{ width: `${pct}%` }} aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => (
          <svg key={i} viewBox="0 0 20 20" className={`${size} shrink-0`} fill="currentColor"><path d={STAR} /></svg>
        ))}
      </span>
      {/* Metallic top-gloss, clipped to the star shapes */}
      <span aria-hidden className="pointer-events-none absolute inset-0" style={{ ...mask, background: 'linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.15) 42%, transparent 66%)' }} />
      {/* Periodic specular shimmer sweep, clipped to the star shapes */}
      {shimmer && (
        <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={mask}>
          <span className="star-shimmer-sweep" />
        </span>
      )}
    </span>
  );
}
