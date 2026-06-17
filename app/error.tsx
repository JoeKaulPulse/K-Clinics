'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

// BLD-460: root error boundary for pages rendered directly under app/ that
// would otherwise skip segment-level boundaries and fall through to global-error.tsx.
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);
  return (
    <div className="grid min-h-screen place-items-center bg-[var(--color-bone)] p-6 text-center">
      <div className="max-w-md">
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-gold)]">KClinics</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl">Something went wrong.</h1>
        <p className="mt-3 text-sm text-[var(--color-stone)]">An unexpected error occurred{error?.digest ? ` (ref: ${error.digest})` : ''}. Try again, or reload the page.</p>
        <button onClick={reset} className="mt-5 rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm text-[var(--color-porcelain)]">Try again</button>
      </div>
    </div>
  );
}
