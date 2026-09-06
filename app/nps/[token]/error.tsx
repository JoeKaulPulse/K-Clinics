'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

// BLD-1611: reached from a link/QR with nobody necessarily watching for a
// stuck "Try again" screen. A thrown render error would otherwise fall back to
// app/error.tsx and wait on a manual click. Auto-calls reset() on a timer
// instead: if the underlying cause has cleared, the page just comes back; if
// not, it retries again a few seconds later.
const RETRY_MS = 10_000;

export default function NpsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
    const t = setTimeout(reset, RETRY_MS);
    return () => clearTimeout(t);
  }, [error, reset]);

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--color-bone)] px-5 py-16 text-center">
      <div className="mx-auto max-w-md rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-8">
        <h1 className="font-[family-name:var(--font-display)] text-2xl">One moment…</h1>
        <p className="mt-2 text-sm text-[var(--color-stone)]">Reconnecting you now.</p>
      </div>
    </main>
  );
}
