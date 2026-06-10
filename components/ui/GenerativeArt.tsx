/** Generative gradient "art" used in place of stock imagery.
 *  Layered mesh + orbs + a metallic sheen + grain — always text-free.
 *  Rendered statically (no JS, no continuous animation) so it reads as rich,
 *  hand-crafted depth without costing paint work while scrolling. */
export function GenerativeArt({
  from,
  to,
  className = '',
  seed = 0,
}: {
  from: string;
  to: string;
  className?: string;
  seed?: number;
}) {
  const orbs = [
    { x: '10%', y: '16%', s: 300, c: to },
    { x: '74%', y: '12%', s: 380, c: from },
    { x: '60%', y: '70%', s: 320, c: to },
    { x: '20%', y: '80%', s: 240, c: from },
  ];

  // Only apply our own `relative` when the caller hasn't supplied a position
  // utility (e.g. `absolute inset-0`); otherwise the two conflict and the box
  // can collapse to zero height.
  const hasPosition = /\b(absolute|fixed|sticky|relative)\b/.test(className);

  return (
    <div
      className={`grain overflow-hidden ${hasPosition ? '' : 'relative'} ${className}`}
      style={{
        backgroundColor: from,
        backgroundImage: `linear-gradient(135deg, ${from}, ${to})`,
      }}
      aria-hidden
    >
      {/* Layered mesh for depth */}
      <span
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(60% 60% at 78% 18%, ${from}cc, transparent 60%), radial-gradient(50% 50% at 22% 82%, ${to}b3, transparent 60%)`,
        }}
      />

      {orbs.map((o, i) => (
        <span
          key={i}
          className="absolute rounded-full blur-3xl"
          style={{
            left: o.x,
            top: o.y,
            width: o.s,
            height: o.s,
            background: o.c,
            opacity: 0.5,
            mixBlendMode: 'soft-light',
            transform: `rotate(${seed * 7}deg)`,
          }}
        />
      ))}

      {/* Static metallic sheen — the "luxury" tell */}
      <span
        className="pointer-events-none absolute -inset-4 overflow-hidden"
        style={{
          background:
            'conic-gradient(from 210deg, transparent 0deg, rgba(255,255,255,0.10) 40deg, transparent 90deg, transparent 270deg, rgba(255,255,255,0.07) 310deg, transparent 360deg)',
          mixBlendMode: 'overlay',
        }}
      />

      {/* Top light + bottom shade + vignette */}
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,rgba(255,255,255,0.30),transparent_55%)]" />
      <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(42,36,32,0.40),transparent_46%)]" />
      <span className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(42,36,32,0.35)]" />
    </div>
  );
}
