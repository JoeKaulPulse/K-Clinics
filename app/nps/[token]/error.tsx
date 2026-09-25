'use client';

import { useAutoRecover } from '@/components/system/useAutoRecover';

// BLD-1611: reached from a link/QR with nobody necessarily watching for a
// stuck "Try again" screen. A thrown render error would otherwise fall back to
// app/error.tsx and wait on a manual click. useAutoRecover retries on its own,
// with backoff and a capped retry interval so a PERMANENT error degrades to a
// quiet slow retry rather than a reset/Sentry event every few seconds forever.
const RETRY_MS = 10_000;

export default function NpsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useAutoRecover(error, reset, RETRY_MS);

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--color-bone)] px-5 py-16 text-center">
      <div className="mx-auto max-w-md rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-8">
        <h1 className="font-[family-name:var(--font-display)] text-2xl">One moment…</h1>
        <p className="mt-2 text-sm text-[var(--color-stone)]">Reconnecting you now.</p>
      </div>
    </main>
  );
}
