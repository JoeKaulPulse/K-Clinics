'use client';

import { KMark, ClinicsWordmark } from '@/components/brand/marks';
import { useAutoRecover } from '@/components/system/useAutoRecover';

// BLD-1611: this is the client's phone-first live-visit companion, opened from
// a QR code on an in-clinic screen — often left propped up and unattended
// through the visit rather than actively watched. A thrown render error would
// otherwise fall back to app/error.tsx and sit on a manual "Try again" until
// someone notices. useAutoRecover retries on its own, with backoff and a capped
// retry interval so a PERMANENT error degrades to a quiet slow retry rather
// than a reset/Sentry event every few seconds forever.
const RETRY_MS = 10_000;

export default function LiveError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useAutoRecover(error, reset, RETRY_MS);

  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--color-night)] p-6 text-center text-[var(--color-night-ink)]">
      <div className="max-w-xs">
        {/* BLD-513/BLD-805: the real logo marks, never typed text, and no
            strap-line beneath them — same lockup as LiveCompanion's header. */}
        <span aria-label="KClinics" className="inline-flex items-center gap-2">
          <span aria-hidden className="block h-6 w-4"><KMark /></span>
          <span aria-hidden className="block h-[0.6rem] w-[6.5rem]"><ClinicsWordmark /></span>
        </span>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-xl text-[var(--color-night-muted)]">Reconnecting…</h1>
      </div>
    </main>
  );
}
