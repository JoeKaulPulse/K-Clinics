/**
 * Shared rating display. Renders five icons with an accurate fractional fill via
 * a clip overlay — so an aggregate rating (e.g. 4.25, 4.5, 4.75) is shown
 * truthfully with a quarter / half / three-quarter filled face, never rounded up.
 * The glyph is a stylised skincare sheet-mask face (KClinics house style) rather
 * than a star; the semantics stay "<n> out of 5". The face nearly fills its
 * 0 0 20 20 viewBox so a width-based fill maps cleanly to a fraction of the face.
 *
 * The fill carries a soft metallic top-gloss and a periodic specular shimmer
 * sweep — both clipped to the face and gated on prefers-reduced-motion.
 * Highlights are white, so they read on both light and dark surfaces; the base
 * colour stays caller-controlled via `colorClass`.
 */

// A stylised facial sheet-mask: a serene face (closed eyes + fuller lips, cut out)
// with a small beauty sparkle. One even-odd path, so it fills gold by rating and
// renders identically in the empty track and the fill overlay for a clean clip.
const FACE =
  'M10 2C14.8 2 18.4 5.2 18.4 9.4C18.4 13 16 16.2 12.5 17.4C11.6 17.7 10.8 17.9 10 17.9C9.2 17.9 8.4 17.7 7.5 17.4C4 16.2 1.6 13 1.6 9.4C1.6 5.2 5.2 2 10 2Z' + // face (fills the tile width)
  'M5.3 9.4Q6.8 11 8.3 9.4Q6.8 10.1 5.3 9.4Z' + // left closed eye
  'M11.7 9.4Q13.2 11 14.7 9.4Q13.2 10.1 11.7 9.4Z' + // right closed eye
  'M7.4 13.4Q10 15.9 12.6 13.4Q10 14.7 7.4 13.4Z' + // fuller lips
  'M17.3 2.9L17.7 3.8L18.6 4.2L17.7 4.6L17.3 5.5L16.9 4.6L16 4.2L16.9 3.8Z'; // sparkle

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
  "url(\"data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2020%2020'%3E%3Cpath%20fill='%23fff'%20d='M10%202C14.8%202%2018.4%205.2%2018.4%209.4C18.4%2013%2016%2016.2%2012.5%2017.4C11.6%2017.7%2010.8%2017.9%2010%2017.9C9.2%2017.9%208.4%2017.7%207.5%2017.4C4%2016.2%201.6%2013%201.6%209.4C1.6%205.2%205.2%202%2010%202Z'/%3E%3C/svg%3E\")";

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
      {/* Filled overlay, clipped to the rating — a fractional value leaves the last
          face quarter / half / three-quarter filled. */}
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
