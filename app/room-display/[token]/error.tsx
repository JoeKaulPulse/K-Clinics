'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

// BLD-1611: this screen is mounted outside a treatment room with nobody there
// to click "Try again" — the happy-path render self-heals via the meta-refresh
// tag on the page (app/room-display/[token]/page.tsx), but a thrown render
// error skips that tree entirely and falls back to the nearest boundary, which
// otherwise means app/error.tsx and a frozen "Try again" screen until staff
// notice. Auto-calls reset() on a timer instead: if the underlying cause has
// cleared the page just comes back; if not, it throws again and this boundary
// retries once more a few seconds later — silent auto-recovery is the correct
// behaviour for an unattended lobby/room screen.
const RETRY_MS = 12_000;

export default function RoomDisplayError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
    const t = setTimeout(reset, RETRY_MS);
    return () => clearTimeout(t);
  }, [error, reset]);

  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--color-night)] p-[5vmin] text-center text-[var(--color-night-ink)]">
      <div>
        <p className="text-[2.4vmin] uppercase tracking-[0.3em] text-[var(--color-gold-soft)]">KClinics</p>
        <h1 className="mt-[3vmin] font-[family-name:var(--font-display)] text-[6vmin] leading-tight text-[var(--color-night-muted)]">Reconnecting…</h1>
      </div>
    </main>
  );
}
