'use client';

import { useState } from 'react';

// Compliant re-permission: clients who aren't opted in to marketing see a
// gentle, dismissible invitation to opt back in — captured inside the portal (a
// channel they chose to use), never by emailing people who opted out (PECR).
export function MarketingOptInPrompt() {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'hidden'>('idle');

  async function optIn() {
    setState('busy');
    try {
      const res = await fetch('/api/account/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ marketingOptIn: true }) });
      setState(res.ok ? 'done' : 'idle');
    } catch { setState('idle'); }
  }

  if (state === 'hidden') return null;

  return (
    <section className="mt-8 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/8 p-6">
      {state === 'done' ? (
        <p className="text-sm text-[var(--color-ink)]">✨ You’re in — thank you! You’ll now hear about exclusive offers and skincare tips. You can change this any time in your profile.</p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-[family-name:var(--font-display)] text-lg">Want first access to offers?</p>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Opt in to receive exclusive member offers, seasonal promotions and skincare tips. We may also use your contact details, in hashed form, to show you our offers on social media — see our Privacy Policy. Unsubscribe any time.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={optIn} disabled={state === 'busy'} className="rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm font-medium text-[var(--color-porcelain)] disabled:opacity-60">{state === 'busy' ? 'Saving…' : 'Keep me updated'}</button>
            <button onClick={() => setState('hidden')} className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">Not now</button>
          </div>
        </div>
      )}
    </section>
  );
}
