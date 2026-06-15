// Paired / interstitial scene — shown when a phone has claimed the session
// (paired, consent) and while they pick photos (review). The screen's only job
// is to be warm and hand attention to the phone.

export function PairedScene({
  eyebrow = 'Connected',
  headline,
  sub,
}: {
  eyebrow?: string;
  headline: React.ReactNode;
  sub: string;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-[4vmin] px-[8vmin] text-center">
      {/* Pulsing beacon */}
      <div className="relative h-[16vmin] w-[16vmin]">
        <span className="kd-pulse-ring" aria-hidden />
        <span className="kd-pulse-ring" style={{ animationDelay: '1.4s' }} aria-hidden />
        <div className="absolute inset-[30%] flex items-center justify-center rounded-full border border-[rgba(194,165,137,0.5)] bg-[rgba(169,138,109,0.14)]">
          <svg viewBox="0 0 24 24" className="h-[45%] w-[45%]" fill="none" stroke="var(--color-gold-bright)" strokeWidth="1.5" aria-hidden>
            <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
            <circle cx="12" cy="18" r="0.9" fill="var(--color-gold-bright)" stroke="none" />
          </svg>
        </div>
      </div>

      <p className="font-[family-name:var(--font-display)] text-[clamp(0.9rem,1.8vmin,1.4rem)] uppercase tracking-[0.4em] text-[var(--color-gold-soft)]">
        {eyebrow}
      </p>
      <h1 className="max-w-[80vmin] font-[family-name:var(--font-display)] text-[clamp(2.4rem,8vmin,6.5rem)] leading-[1.05] text-[var(--color-porcelain)] landscape:max-w-[70vw]">
        {headline}
      </h1>
      <p className="max-w-[70vmin] text-[clamp(1rem,2.2vmin,1.6rem)] text-[var(--color-blush)] landscape:max-w-[50vw]">
        {sub}
      </p>
    </div>
  );
}
