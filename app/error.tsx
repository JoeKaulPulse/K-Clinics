'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { KMark, ClinicsWordmark } from '@/components/brand/marks';

// BLD-460: root error boundary for pages rendered directly under app/ that
// would otherwise skip segment-level boundaries and fall through to global-error.tsx.
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);
  return (
    <div className="grid min-h-screen place-items-center bg-[var(--color-bone)] p-6 text-center">
      <div className="max-w-md">
        {/* BLD-513: render the brand marks, never the brand name as plain text (brand guidelines). */}
        <span aria-label="KClinics" className="inline-flex flex-col items-center gap-2.5 text-[var(--color-ink)]">
          <span aria-hidden className="block h-10 w-[1.4rem]"><KMark /></span>
          <span aria-hidden className="block h-[0.58rem] w-[6.5rem]"><ClinicsWordmark /></span>
        </span>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-2xl">Something went wrong.</h1>
        <p className="mt-3 text-sm text-[var(--color-stone)]">An unexpected error occurred{error?.digest ? ` (ref: ${error.digest})` : ''}. Try again, or reload the page.</p>
        <button onClick={reset} className="mt-5 rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm text-[var(--color-porcelain)]">Try again</button>
      </div>
    </div>
  );
}
