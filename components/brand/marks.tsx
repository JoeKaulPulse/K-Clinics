/**
 * Brand marks rendered as INLINE SVG (full SVG content, not masked or rasterised).
 *
 * Replace the inner SVG markup below with the supplied "K" and "CLINICS" vectors.
 * Guidelines so they drop in cleanly:
 *   • Keep the outer <svg> with its `viewBox` and `fill`/`stroke` set to
 *     `currentColor` where you want the colour to follow the surrounding text
 *     (so the logo flips to porcelain over dark heroes). If the real artwork is
 *     multi-colour, hard-code those colours instead and it will render verbatim.
 *   • Keep `width="100%" height="100%"` so the wrapper controls sizing.
 */

export function KMark({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      width="100%"
      height="100%"
      className={className}
      role="img"
      aria-label="K Clinics"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* ── REPLACE: supplied "K" vector ─────────────────────────────────── */}
      <circle cx="60" cy="60" r="58" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
      <path
        d="M40 28 V92 M40 60 L82 28 M52 56 L84 92"
        fill="none"
        stroke="currentColor"
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* ─────────────────────────────────────────────────────────────────── */}
    </svg>
  );
}

export function ClinicsWordmark({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 360 44"
      width="100%"
      height="100%"
      className={className}
      role="img"
      aria-label="CLINICS"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* ── REPLACE: supplied "CLINICS" vector ───────────────────────────── */}
      <text
        x="180"
        y="33"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="34"
        letterSpacing="14"
        fill="currentColor"
      >
        CLINICS
      </text>
      {/* ─────────────────────────────────────────────────────────────────── */}
    </svg>
  );
}
