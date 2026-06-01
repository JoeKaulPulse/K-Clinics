/**
 * Shared star-rating display. Renders five stars with an accurate fractional
 * fill (e.g. 4.8 ★) using a clip overlay — so an aggregate rating is shown
 * truthfully, never rounded up to a flattering 5. The star path sits within a
 * 0 0 20 20 viewBox (no overflow / warping).
 */
const STAR = 'M10 1l2.47 5.18 5.68.74-4.18 3.9 1.06 5.62L10 19.4 4.97 16.44l1.06-5.62-4.18-3.9 5.68-.74z';

export function Stars({
  rating = 5,
  size = 'h-4 w-4',
  className = '',
  colorClass = 'text-[var(--color-gold)]',
  trackClass = 'text-[color-mix(in_oklab,currentColor_22%,transparent)]',
}: {
  rating?: number;
  size?: string;
  className?: string;
  colorClass?: string;
  trackClass?: string;
}) {
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
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
    </span>
  );
}
