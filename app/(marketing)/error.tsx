'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button, ArrowIcon } from '@/components/ui/Button';
import { GenerativeArt } from '@/components/ui/GenerativeArt';

// Branded error boundary for the marketing site. Keeps the header/footer chrome
// and offers a graceful recovery.
export default function MarketingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]); // BLD-420
  return (
    <section className="relative grid min-h-[70svh] place-items-center overflow-hidden">
      <GenerativeArt from="#2a2420" to="#4a3f37" className="absolute inset-0" />
      <div className="container-narrow relative z-10 text-center text-[var(--color-porcelain)]">
        <p className="eyebrow mb-5 text-[var(--color-gold-soft)]">Something went wrong</p>
        <h1 className="text-display">A small hiccup.</h1>
        <p className="mx-auto mt-6 max-w-md text-lg text-[color-mix(in_oklab,var(--color-porcelain)_76%,transparent)]">
          We couldn’t load this just now. Please try again — or call us and we’ll happily help.
        </p>
        <div className="mt-9 flex justify-center gap-3">
          <Button onClick={reset}>Try again <ArrowIcon /></Button>
          <Button href="/" variant="outline">Return home</Button>
        </div>
      </div>
    </section>
  );
}
