// Closing scenes. 'share' celebrates the result and points at the phone for
// sharing; 'goodbye' is the warm terminal for declined/failed sessions. Both
// are short-lived — the orchestrator reloads the page after them, minting a
// fresh QR session and clearing all frame/photo state from memory.

function Spark({ delay, left, top, size }: { delay: number; left: string; top: string; size: number }) {
  return (
    <svg
      className="kd-spark"
      style={{ left, top, width: size, height: size, ['--kd-delay' as never]: `${delay}s` }}
      viewBox="0 0 24 24"
      fill="var(--color-gold-bright)"
      aria-hidden
    >
      <path d="M12 0c1 7 5 11 12 12-7 1-11 5-12 12-1-7-5-11-12-12 7-1 11-5 12-12z" />
    </svg>
  );
}

const SPARKS: Array<[number, string, string, number]> = [
  [0, '14%', '22%', 26], [0.7, '82%', '18%', 18], [1.3, '70%', '74%', 30],
  [1.9, '22%', '78%', 16], [0.4, '88%', '52%', 22], [1.6, '8%', '52%', 14],
];

export function ShareScene({ variant }: { variant: 'share' | 'goodbye' }) {
  const share = variant === 'share';
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-[3.5vmin] px-[8vmin] text-center">
      {SPARKS.map(([delay, left, top, size], i) => (
        <Spark key={i} delay={delay} left={left} top={top} size={size} />
      ))}

      <p className="font-[family-name:var(--font-display)] text-[clamp(0.9rem,1.8vmin,1.4rem)] uppercase tracking-[0.4em] text-[var(--color-gold-soft)]">
        {share ? 'All yours' : 'Until next time'}
      </p>
      <h1 className="max-w-[84vmin] font-[family-name:var(--font-display)] text-[clamp(2.6rem,8.5vmin,7rem)] leading-[1.04] text-[var(--color-porcelain)] landscape:max-w-[72vw]">
        {share ? (
          <>Share your <span className="text-gold-shimmer">glow</span> ✨</>
        ) : (
          <>Thanks for stopping by <span className="text-gold-shimmer">✨</span></>
        )}
      </h1>
      <p className="max-w-[70vmin] text-[clamp(1rem,2.3vmin,1.7rem)] text-[var(--color-blush)] landscape:max-w-[50vw]">
        {share
          ? 'Your code and reward are on your phone — show this off and come say hello inside.'
          : 'No result this time. The screen is yours again in a moment.'}
      </p>
      <p className="text-[clamp(0.8rem,1.6vmin,1.1rem)] uppercase tracking-[0.3em] text-[rgba(246,236,227,0.45)]">
        Islington · London
      </p>
    </div>
  );
}
