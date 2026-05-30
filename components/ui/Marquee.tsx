/** Seamless marquee band — used for the editorial word ribbon. CSS-driven. */
export function Marquee({ items, className = '' }: { items: string[]; className?: string }) {
  const row = [...items, ...items];
  return (
    <div className={`group relative flex overflow-hidden ${className}`} aria-hidden>
      <div className="animate-marquee flex shrink-0 items-center whitespace-nowrap [animation-play-state:running] group-hover:[animation-play-state:paused]">
        {row.map((it, i) => (
          <span key={i} className="flex items-center">
            <span className="font-[family-name:var(--font-display)] text-[clamp(1.5rem,4vw,2.75rem)] tracking-tight">
              {it}
            </span>
            <span className="mx-8 text-[--color-gold]">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
