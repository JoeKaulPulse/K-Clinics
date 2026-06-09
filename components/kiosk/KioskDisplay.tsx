'use client';

import { useEffect, useState } from 'react';

// Full-screen storefront display. The QR encodes a fresh session URL; every 20
// minutes we reload the page so a new session token is minted (and the prior one
// is allowed to expire), with a live countdown shown beneath the code.
const REGEN_MS = 20 * 60 * 1000;

export function KioskDisplay({ svg, url }: { svg: string; url: string }) {
  const [remaining, setRemaining] = useState(REGEN_MS);

  useEffect(() => {
    const started = Date.now();
    const tick = setInterval(() => {
      const left = REGEN_MS - (Date.now() - started);
      if (left <= 0) {
        window.location.reload();
        return;
      }
      setRemaining(left);
    }, 1000);
    return () => clearInterval(tick);
  }, [url]);

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 bg-[var(--color-ink)] px-8 py-12 text-center text-[var(--color-porcelain)]">
      <div>
        <p className="font-[family-name:var(--font-display)] text-sm uppercase tracking-[0.3em] text-[var(--color-gold-soft)]">
          KClinics
        </p>
        <h1 className="mt-4 max-w-3xl font-[family-name:var(--font-display)] text-5xl leading-tight md:text-6xl">
          Scan to discover your skin &amp; smile score <span className="text-[var(--color-gold-bright)]">✨</span>
        </h1>
        <p className="mt-4 text-lg text-[var(--color-blush)]">
          Point your camera at the code — your AI rating takes about 30 seconds.
        </p>
      </div>

      <div className="rounded-[var(--radius-lg)] bg-white p-8 shadow-2xl">
        <div className="h-[340px] w-[340px] md:h-[420px] md:w-[420px]" dangerouslySetInnerHTML={{ __html: svg }} />
      </div>

      <p className="text-sm text-[var(--color-stone-soft)]">
        New code in {mins}:{secs.toString().padStart(2, '0')}
      </p>
    </main>
  );
}
