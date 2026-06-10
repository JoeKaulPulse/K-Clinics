// Attract loop: dark ink canvas, slow gold shimmer, drifting dots, three
// rotating Fraunces value lines (pure-CSS 18s crossfade cycle), breathing QR
// card and the "New code in mm:ss" regen countdown. Portrait stacks
// vertically; landscape splits copy left / QR right.

const VALUE_LINES = [
  <>Discover your <span className="text-gold-shimmer">skin &amp; smile</span> score</>,
  <>Sixty seconds of <span className="text-gold-shimmer">pure glow</span></>,
  <>Real compliments, <span className="text-gold-shimmer">read by AI</span></>,
];

export function AttractScene({ svg, remainingMs }: { svg: string; remainingMs: number }) {
  const mins = Math.max(0, Math.floor(remainingMs / 60000));
  const secs = Math.max(0, Math.floor((remainingMs % 60000) / 1000));

  return (
    <div className="kd-attract">
      {/* Copy block */}
      <div className="flex w-full max-w-[88vmin] flex-col gap-[2.5vmin] portrait:items-center landscape:items-start landscape:max-w-none landscape:self-center">
        <p className="font-[family-name:var(--font-display)] text-[clamp(1rem,2vmin,1.6rem)] uppercase tracking-[0.4em] text-[var(--color-gold-soft)]">
          K Clinics — Skin &amp; Smile
        </p>
        <div className="kd-lines h-[34vmin] landscape:h-[36vmin]">
          {VALUE_LINES.map((line, i) => (
            <h1
              key={i}
              className="kd-line font-[family-name:var(--font-display)] text-[clamp(2.6rem,9vmin,7.5rem)] leading-[1.04] tracking-[-0.02em] text-[var(--color-porcelain)]"
            >
              <span>{line}</span>
            </h1>
          ))}
        </div>
        <p className="text-[clamp(1rem,2.2vmin,1.7rem)] text-[var(--color-blush)]">
          Point your camera at the code — it takes about a minute.
        </p>
      </div>

      {/* Breathing QR */}
      <div className="relative flex items-center justify-center portrait:py-[3vmin]">
        <div className="relative">
          <div className="kd-qr-halo" aria-hidden />
          <div className="kd-qr-card">
            <div
              className="h-[min(48vmin,30rem)] w-[min(48vmin,30rem)]"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
        </div>
      </div>

      {/* Footer line */}
      <div className="flex flex-col items-center gap-[0.8vmin] landscape:col-span-2 landscape:flex-row landscape:justify-between landscape:gap-0">
        <p className="text-[clamp(0.75rem,1.5vmin,1.1rem)] uppercase tracking-[0.3em] text-[rgba(246,236,227,0.45)]">
          Free · Private · 18+
        </p>
        <p className="text-[clamp(0.75rem,1.5vmin,1.1rem)] tabular-nums text-[rgba(246,236,227,0.45)]">
          New code in {mins}:{secs.toString().padStart(2, '0')}
        </p>
      </div>
    </div>
  );
}
