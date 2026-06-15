/**
 * Shared rating display. Renders five icons with an accurate fractional fill
 * (e.g. 4.5) using a clip overlay — so an aggregate rating is shown truthfully,
 * never rounded up to a flattering 5. The glyph is a stylised skincare sheet-mask
 * face (KClinics house style) rather than a star; the semantics stay "<n> out of
 * 5". Each glyph sits within a 0 0 20 20 viewBox (no overflow / warping).
 *
 * The fill carries a soft metallic top-gloss and a periodic specular shimmer
 * sweep — both clipped to the face and gated on prefers-reduced-motion.
 * Highlights are white, so they read on both light and dark surfaces; the base
 * colour stays caller-controlled via `colorClass`.
 */

// A stylised facial sheet-mask: a serene face (closed eyes + soft mouth, cut out)
// with a small beauty sparkle. One even-odd path, so it fills gold by rating and
// renders identically in the empty track and the fill overlay for a clean clip.
const FACE =
  'M10 2.8C13.3 2.8 15.8 5.2 15.8 8.6C15.8 12.8 13.2 16.9 10 16.9C6.8 16.9 4.2 12.8 4.2 8.6C4.2 5.2 6.7 2.8 10 2.8Z' + // face
  'M6.3 8.6Q7.6 10.2 8.9 8.6Q7.6 9.5 6.3 8.6Z' + // left closed eye
  'M11.1 8.6Q12.4 10.2 13.7 8.6Q12.4 9.5 11.1 8.6Z' + // right closed eye
  'M8.6 12.9Q10 14.1 11.4 12.9Q10 13.5 8.6 12.9Z' + // soft mouth
  'M16.3 2.7L16.75 3.65L17.7 4.1L16.75 4.55L16.3 5.5L15.85 4.55L14.9 4.1L15.85 3.65Z'; // sparkle

function MaskGlyph({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="currentColor">
      <path fillRule="evenodd" d={FACE} />
    </svg>
  );
}

// The face body as a CSS mask (alpha channel), tiled 5× across the row so the
// gloss + shimmer overlays clip to exactly the five faces. Filled WHITE: CSS
// mask-image uses luminance by default (white = shown, transparent = hidden).
const FACE_MASK =
  "url(\"data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2020%2020'%3E%3Cpath%20fill='%23fff'%20d='M10%202.8C13.3%202.8%2015.8%205.2%2015.8%208.6C15.8%2012.8%2013.2%2016.9%2010%2016.9C6.8%2016.9%204.2%2012.8%204.2%208.6C4.2%205.2%206.7%202.8%2010%202.8Z'/%3E%3C/svg%3E\")";

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
    WebkitMaskImage: FACE_MASK, maskImage: FACE_MASK,
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
      {/* Metallic top-gloss, clipped to the face shapes */}
      <span aria-hidden className="pointer-events-none absolute inset-0" style={{ ...mask, background: 'linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.15) 42%, transparent 66%)' }} />
      {/* Periodic specular shimmer sweep, clipped to the face shapes */}
      {shimmer && (
        <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={mask}>
          <span className="star-shimmer-sweep" />
        </span>
      )}
    </span>
  );
}
