// A gold circular progress ring with a big score in the centre. Pure SVG so it
// renders identically on the mobile flow and the shareable card.
export function ScoreRing({ label, score, max = 10 }: { label: string; score: number; max?: number }) {
  const pct = Math.max(0, Math.min(1, score / max));
  const r = 52;
  const c = 2 * Math.PI * r;
  const dash = c * pct;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-[140px] w-[140px]">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
          <circle cx="70" cy="70" r={r} fill="none" stroke="var(--color-bone)" strokeWidth="10" />
          <circle
            cx="70" cy="70" r={r} fill="none"
            stroke="var(--color-gold)" strokeWidth="10" strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-[family-name:var(--font-display)] text-3xl text-[var(--color-ink)]">{score}</span>
          <span className="text-xs text-[var(--color-stone)]">/ {max}</span>
        </div>
      </div>
      <span className="text-sm font-medium uppercase tracking-wide text-[var(--color-stone)]">{label}</span>
    </div>
  );
}
