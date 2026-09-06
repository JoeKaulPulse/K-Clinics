'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

// BLD-1611: this is the client's phone-first live-visit companion, opened from
// a QR code on an in-clinic screen — often left propped up and unattended
// through the visit rather than actively watched. A thrown render error would
// otherwise fall back to app/error.tsx and sit on a manual "Try again" until
// someone notices. Auto-calls reset() on a timer instead: if the underlying
// cause has cleared, the page just comes back; if not, it retries again a few
// seconds later.
const RETRY_MS = 10_000;

export default function LiveError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
    const t = setTimeout(reset, RETRY_MS);
    return () => clearTimeout(t);
  }, [error, reset]);

  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--color-night)] p-6 text-center text-[var(--color-night-ink)]">
      <div className="max-w-xs">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-gold-soft)]">KClinics</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-xl text-[var(--color-night-muted)]">Reconnecting…</h1>
      </div>
    </main>
  );
}
