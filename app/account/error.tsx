'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function AccountError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]); // BLD-420
  return (
    <div className="grid min-h-[70vh] place-items-center p-6 text-center">
      <div className="max-w-md">
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-gold-deep)]">Your account</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl">Something went wrong.</h1>
        <p className="mt-3 text-sm text-[var(--color-stone)]">We couldn’t load this just now. Please try again.</p>
        <button onClick={reset} className="mt-5 rounded-full bg-[var(--color-gold-deep)] px-5 py-2.5 text-sm font-medium text-white">Try again</button>
      </div>
    </div>
  );
}
