'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { TreatmentFinder } from '@/components/finder/TreatmentFinder';
import { KMark, ClinicsWordmark } from '@/components/brand/marks';

const IDLE_MS = 90_000; // return to the attract screen after 90s of no touch

export function KioskShell({ prices }: { prices: Record<string, number | null> }) {
  const [mode, setMode] = useState<'attract' | 'active'>('attract');
  const [run, setRun] = useState(0); // bump to remount the finder fresh
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const begin = useCallback(() => { setRun((r) => r + 1); setMode('active'); }, []);
  const reset = useCallback(() => { setMode('attract'); }, []);

  // Idle watchdog — only while active.
  useEffect(() => {
    if (mode !== 'active') return;
    const bump = () => { if (idle.current) clearTimeout(idle.current); idle.current = setTimeout(reset, IDLE_MS); };
    bump();
    const events: (keyof DocumentEventMap)[] = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach((e) => document.addEventListener(e, bump, { passive: true }));
    return () => { events.forEach((e) => document.removeEventListener(e, bump)); if (idle.current) clearTimeout(idle.current); };
  }, [mode, reset]);

  if (mode === 'attract') {
    return (
      <button
        onClick={begin}
        className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[var(--color-ink)] px-8 text-center text-[var(--color-porcelain)]"
      >
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_-10%,color-mix(in_oklab,var(--color-gold)_26%,transparent),transparent_60%)]" />
        <span className="block h-24 w-16 text-[var(--color-gold-soft)]"><KMark animated /></span>
        <p className="mt-10 text-sm uppercase tracking-[0.35em] text-[var(--color-gold-soft)]">Islington · London</p>
        <h1 className="mt-5 max-w-3xl font-[family-name:var(--font-display)] text-[clamp(2.5rem,6vw,5rem)] leading-[1.04]">
          Discover your <span className="text-gold-shimmer">perfect</span> treatment.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-[color-mix(in_oklab,var(--color-porcelain)_75%,transparent)]">
          Answer a few quick questions and we’ll build your personalised plan — in under a minute.
        </p>
        <span className="mt-12 inline-flex items-center gap-3 rounded-full border border-[var(--color-gold-soft)]/40 px-8 py-4 text-lg font-medium text-[var(--color-gold-soft)]">
          Tap to begin
        </span>
      </button>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-porcelain)] px-6 py-8 md:px-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-[var(--color-gold-deep)]" aria-label="KClinics">
            <span className="block h-6 w-4"><KMark /></span>
            <span className="block h-[0.6rem] w-[6.5rem]"><ClinicsWordmark /></span>
          </span>
          <button onClick={reset} className="rounded-full border border-[var(--color-line)] px-5 py-2 text-sm text-[var(--color-stone)] hover:border-[var(--color-gold)]">Start over</button>
        </div>

        <TreatmentFinder key={run} prices={prices} />

        <KioskCapture />
      </div>
    </div>
  );
}

function KioskCapture() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');

  async function submit() {
    if (!/\S+@\S+\.\S+/.test(email)) { setStatus('error'); return; }
    setStatus('busy');
    try {
      const r = await fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }).then((x) => x.json()).catch(() => ({ ok: false }));
      setStatus(r.ok ? 'done' : 'error');
    } catch { setStatus('error'); }
  }

  if (status === 'done') {
    return (
      <div className="mt-8 rounded-[var(--radius-xl)] border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/8 p-8 text-center">
        <h3 className="font-[family-name:var(--font-display)] text-2xl">Your plan is on its way ✓</h3>
        <p className="mx-auto mt-2 max-w-md text-[var(--color-stone)]">We’ve sent it to your inbox, along with <strong>15% off your first visit</strong>. Ask our team and we’ll book you in now.</p>
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-6 md:p-8">
      <h3 className="font-[family-name:var(--font-display)] text-2xl">Email me my plan — and 15% off my first visit</h3>
      <p className="mt-1 text-sm text-[var(--color-stone)]">We’ll send your recommendations and a welcome offer. Unsubscribe any time.</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="flex-1 rounded-full border border-[var(--color-line)] bg-[var(--color-porcelain)] px-5 py-3.5 text-lg outline-none focus:border-[var(--color-gold)]"
        />
        <button onClick={submit} disabled={status === 'busy'} className="rounded-full bg-[var(--color-gold-deep)] px-7 py-3.5 text-lg font-medium text-white disabled:opacity-60">
          {status === 'busy' ? 'Sending…' : 'Send my plan'}
        </button>
      </div>
      {status === 'error' && <p className="mt-2 text-sm text-[var(--color-blush)]">Please enter a valid email and try again.</p>}
    </div>
  );
}
