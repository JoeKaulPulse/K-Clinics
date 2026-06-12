/** Soft champagne/rose aurora for dark sections — adds depth behind content.
 *  Purely decorative; sits behind via negative z. Rendered statically (no JS /
 *  no continuous animation) so it never costs paint work while scrolling. */
export function Aurora({ className = '' }: { className?: string }) {
  const blobs = [
    { c: 'var(--color-gold)', x: '15%', y: '20%', s: 520 },
    // Decorative warm taupe (not the semantic jade-green status accent) — keeps
    // the champagne/rose aurora warm rather than tinting it green.
    { c: '#7b6a5d', x: '78%', y: '30%', s: 560 },
    { c: 'var(--color-blush)', x: '55%', y: '85%', s: 460 },
  ];
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {blobs.map((b, i) => (
        <span
          key={i}
          className="absolute rounded-full blur-[90px]"
          style={{ left: b.x, top: b.y, width: b.s, height: b.s, background: b.c, opacity: 0.14 }}
        />
      ))}
    </div>
  );
}
