/** Seamless marquee band — used for the editorial word ribbon. CSS-driven. */
export function Marquee({ items, className = '' }: { items: string[]; className?: string }) {
  const row = [...items, ...items];
  return (
    <div className={`group relative flex overflow-hidden ${className}`} aria-hidden>
      <div className="animate-marquee flex shrink-0 items-center whitespace-nowrap [animation-play-state:running] group-hover:[animation-play-state:paused]">
        {row.map((it, i) => (
          <span key={i} className="flex items-center">
            <span className="font-[family-name:var(--font-display)] text-[clamp(1.25rem,1rem+3vw,2.75rem)] tracking-tight">
              {it}
            </span>
            <span className="mx-5 text-[var(--color-gold)] md:mx-8">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
