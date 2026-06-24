// Corner chrome shown on every non-attract scene. The session token is
// single-use, so during a live session we don't re-show the (already claimed)
// QR — instead an elegant "one at a time" promise for queued passers-by.

import { KMark, ClinicsWordmark } from '@/components/brand/marks';

export function BrandCorner() {
  return (
    <div className="kd-brand-corner">
      {/* Brand rule: render the supplied logo mark — never typeset the brand
          name as plain text in the logo's place. */}
      <span className="inline-flex items-center gap-[1.2vmin] text-[var(--color-gold-soft)]" aria-label="KClinics">
        <span className="block h-[3.6vmin] w-[2vmin]"><KMark /></span>
        <span className="block h-[1.5vmin] w-[15vmin]"><ClinicsWordmark /></span>
      </span>
      <p className="mt-[1vmin] text-[clamp(0.55rem,1vmin,0.8rem)] uppercase tracking-[0.24em] text-[rgba(246,236,227,0.45)]">
        Islington · London
      </p>
    </div>
  );
}

export function CornerBadge() {
  return (
    <div className="kd-corner">
      <div className="rounded-[var(--radius-md)] border border-[rgba(194,165,137,0.35)] bg-[rgba(28,23,19,0.85)] px-[2.2vmin] py-[1.6vmin] text-right shadow-[0_10px_40px_-12px_rgba(0,0,0,0.6)]">
        <p className="text-[clamp(0.7rem,1.3vmin,1rem)] font-medium text-[var(--color-gold-bright)]">
          One at a time ✨
        </p>
        <p className="mt-0.5 text-[clamp(0.6rem,1.1vmin,0.85rem)] text-[rgba(246,236,227,0.6)]">
          Back in a moment — stay close
        </p>
      </div>
    </div>
  );
}
