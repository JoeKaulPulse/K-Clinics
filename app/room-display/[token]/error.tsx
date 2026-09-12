'use client';

import { KMark, ClinicsWordmark } from '@/components/brand/marks';
import { useAutoRecover } from '@/components/system/useAutoRecover';

// BLD-1611: this screen is mounted outside a treatment room with nobody there
// to click "Try again" — the happy-path render self-heals via the meta-refresh
// tag on the page (app/room-display/[token]/page.tsx), but a thrown render
// error skips that tree entirely and falls back to the nearest boundary, which
// otherwise means app/error.tsx and a frozen "Try again" screen until staff
// notice. useAutoRecover retries on its own, with backoff and a capped retry
// interval so a PERMANENT error degrades to a quiet slow retry rather than a
// reset/Sentry event every few seconds forever.
const RETRY_MS = 12_000;

export default function RoomDisplayError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useAutoRecover(error, reset, RETRY_MS);

  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--color-night)] p-[5vmin] text-center text-[var(--color-night-ink)]">
      <div>
        {/* BLD-513: render the brand marks, never the brand name as plain text
            (docs/BRAND_GUIDELINES.md) — and no strap-line beneath them. */}
        <span aria-label="KClinics" className="inline-flex items-center gap-[1.2vmin]">
          <span aria-hidden className="block h-[5vmin] w-[3.3vmin]"><KMark /></span>
          <span aria-hidden className="block h-[1.2vmin] w-[13vmin]"><ClinicsWordmark /></span>
        </span>
        <h1 className="mt-[3vmin] font-[family-name:var(--font-display)] text-[6vmin] leading-tight text-[var(--color-night-muted)]">Reconnecting…</h1>
      </div>
    </main>
  );
}
