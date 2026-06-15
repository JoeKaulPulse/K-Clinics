/**
 * Shared rating display. Renders five icons with an accurate fractional fill
 * (e.g. 4.5) using a clip overlay — so an aggregate rating is shown truthfully,
 * never rounded up to a flattering 5. The glyph is a stylised surgical face mask
 * (KClinics house style) rather than a star; the semantics stay "<n> out of 5".
 * Each glyph sits within a 0 0 20 20 viewBox (no overflow / warping).
 *
 * The fill carries a soft metallic top-gloss and a periodic specular shimmer
 * sweep — both clipped to the mask body and gated on prefers-reduced-motion.
 * Highlights are white, so they read on both light and dark surfaces; the base
 * colour stays caller-controlled via `colorClass`.
 */

// A stylised surgical face mask: a pleated rounded body (two pleats cut out) with
// an ear loop on each side. Rendered identically in the empty track and the
// gold fill overlay so the fractional clip reads cleanly across the row.
function MaskGlyph({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="currentColor">
      {/* Ear loops */}
      <path d="M5.7 7.6C3.3 8.2 3.3 12.2 5.7 12.8" fill="none" stroke="currentColor" strokeWidth="1.05" strokeLinecap="round" />
      <path d="M14.3 7.6C16.7 8.2 16.7 12.2 14.3 12.8" fill="none" stroke="currentColor" strokeWidth="1.05" strokeLinecap="round" />
      {/* Pleated mask body — the two thin slots are cut out (even-odd) as pleats */}
      <path fillRule="evenodd" d="M7 6.6H13A1.6 1.6 0 0 1 14.6 8.2V11.8A1.6 1.6 0 0 1 13 13.4H7A1.6 1.6 0 0 1 5.4 11.8V8.2A1.6 1.6 0 0 1 7 6.6ZM6.5 9H13.5V9.45H6.5ZM6.5 10.7H13.5V11.15H6.5Z" />
    </svg>
  );
}

// The mask body as a CSS mask (alpha channel), tiled 5× across the row so the
// gloss + shimmer overlays clip to exactly the five mask shapes. Filled WHITE:
// CSS mask-image uses luminance by default (white = shown, transparent = hidden).
const MASK_MASK =
  "url(\"data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2020%2020'%3E%3Cpath%20fill='%23fff'%20d='M7%206.6H13A1.6%201.6%200%200%201%2014.6%208.2V11.8A1.6%201.6%200%200%201%2013%2013.4H7A1.6%201.6%200%200%201%205.4%2011.8V8.2A1.6%201.6%200%200%201%207%206.6Z'/%3E%3C/svg%3E\")";

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
    WebkitMaskImage: MASK_MASK, maskImage: MASK_MASK,
    WebkitMaskSize: '20% 100%', maskSize: '20% 100%',
    WebkitMaskRepeat: 'repeat', maskRepeat: 'repeat',
  } as const;
  return (
    <span className={`relative inline-flex ${colorClass} ${className}`} role="img" aria-label={`${rating.toFixed(1)} out of 5`}>
      {/* Empty track */}
      <span className={`flex ${trackClass}`} aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => (
          <MaskGlyph key={i} className={size} />
        ))}
      </span>
      {/* Filled overlay, clipped to the rating */}
      <span className="absolute inset-0 flex overflow-hidden" style={{ width: `${pct}%` }} aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => (
          <MaskGlyph key={i} className={`${size} shrink-0`} />
        ))}
      </span>
      {/* Metallic top-gloss, clipped to the mask shapes */}
      <span aria-hidden className="pointer-events-none absolute inset-0" style={{ ...mask, background: 'linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.15) 42%, transparent 66%)' }} />
      {/* Periodic specular shimmer sweep, clipped to the mask shapes */}
      {shimmer && (
        <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={mask}>
          <span className="star-shimmer-sweep" />
        </span>
      )}
    </span>
  );
}
