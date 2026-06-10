// Analyzing scene — the chosen photo under a vertical gold scan-line sweep
// with rotating micro-copy. Photo falls back to the latest live frame if the
// upload URLs haven't streamed through yet; falls back to a pure shimmer
// panel if neither is available (e.g. polling fallback).

const MICRO_LINES = [
  'Reading your glow…',
  'Admiring your best angles…',
  'Counting compliments…',
  'Composing your reveal…',
];

export function AnalyzingScene({ photo }: { photo: string | null }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-[4vmin] px-[6vmin] landscape:flex-row landscape:gap-[7vmin]">
      <div className="kd-scan-photo">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" aria-hidden draggable={false} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[#211b16]" />
        )}
        {/* Soft gold wash so the sweep reads on any photo */}
        <div className="absolute inset-0 bg-[rgba(42,36,32,0.25)]" aria-hidden />
        <div className="kd-scanline" aria-hidden />
      </div>

      <div className="flex flex-col items-center gap-[2vmin] text-center landscape:items-start landscape:text-left">
        <p className="font-[family-name:var(--font-display)] text-[clamp(0.9rem,1.8vmin,1.4rem)] uppercase tracking-[0.4em] text-[var(--color-gold-soft)]">
          One moment
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-[clamp(2.2rem,7vmin,5.5rem)] leading-[1.05] text-[var(--color-porcelain)]">
          The AI is <span className="text-gold-shimmer">looking closely</span>
        </h1>
        <div className="kd-micro w-[min(70vmin,40rem)] text-[clamp(1rem,2.2vmin,1.6rem)] text-[var(--color-blush)] landscape:[&>span]:justify-start">
          {MICRO_LINES.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
