// Ambient drifting gold dots. Deterministic pseudo-random placement (SSR-safe,
// no hydration drift) and hard-capped at 18 nodes (contract: ≤24 animated
// particle nodes). Transform/opacity animation only.

const COUNT = 18;

/** Cheap deterministic hash → [0,1) so server and client render identically. */
function rnd(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function GoldParticles({ count = COUNT }: { count?: number }) {
  const n = Math.min(count, 24);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: n }, (_, i) => {
        const size = 2 + rnd(i, 3) * 4.5;
        const style: React.CSSProperties & Record<string, string> = {
          left: `${(rnd(i, 1) * 96 + 2).toFixed(2)}%`,
          top: `${(rnd(i, 2) * 96 + 2).toFixed(2)}%`,
          width: `${size.toFixed(1)}px`,
          height: `${size.toFixed(1)}px`,
          '--kd-dur': `${(15 + rnd(i, 4) * 17).toFixed(1)}s`,
          '--kd-delay': `${(-rnd(i, 5) * 30).toFixed(1)}s`,
          '--kd-dx': `${((rnd(i, 6) - 0.5) * 7).toFixed(1)}vw`,
          '--kd-dy': `${(-3 - rnd(i, 7) * 8).toFixed(1)}vh`,
          '--kd-op': `${(0.18 + rnd(i, 8) * 0.4).toFixed(2)}`,
        };
        return <span key={i} className="kd-dot" style={style} />;
      })}
    </div>
  );
}
