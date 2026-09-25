'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import Link from 'next/link';

// PRJ-1200.11: pairs "Try again" (re-render) with a "Return to account" escape
// route, so a crash loop doesn't strand a signed-in user with no way out.
export default function AccountError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]); // BLD-420
  return (
    <div className="grid min-h-[70vh] place-items-center p-6 text-center">
      <div className="max-w-md">
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-gold-deep)]">Your account</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl">Something went wrong.</h1>
        <p className="mt-3 text-sm text-[var(--color-stone)]">We couldn’t load this just now. Please try again.</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button onClick={reset} className="rounded-full bg-[var(--color-gold-deep)] px-5 py-2.5 text-sm font-medium text-white">Try again</button>
          <Link href="/account" className="rounded-full border border-[var(--color-line)] px-5 py-2.5 text-sm font-medium text-[var(--color-ink)]">Return to account</Link>
        </div>
      </div>
    </div>
  );
}
