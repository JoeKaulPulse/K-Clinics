'use client';

import { useState } from 'react';

export function NewsletterForm({ source = 'footer' }: { source?: string } = {}) {
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState(''); // honeypot
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/\S+@\S+\.\S+/.test(email)) { setState('error'); setMsg('Please enter a valid email address.'); return; }
    setState('busy'); setMsg('');
    try {
      const res = await fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, company, source }) });
      const j = await res.json().catch(() => ({ ok: false }));
      if (j.ok) { setState('done'); setEmail(''); }
      else { setState('error'); setMsg(j.error || 'Something went wrong.'); }
    } catch { setState('error'); setMsg('Network error. Please try again.'); }
  }

  if (state === 'done') {
    return <p className="rounded-[var(--radius-sm)] border border-white/15 bg-white/[0.05] px-4 py-3 text-sm text-[var(--color-gold-soft)]">Thank you — you’re on the list. Look out for our next edit.</p>;
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="flex overflow-hidden rounded-[var(--radius-sm)] border border-white/20 bg-white/[0.04] focus-within:border-[var(--color-gold-soft)]">
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (state === 'error') setState('idle'); }}
          placeholder="Your email address"
          aria-label="Your email address"
          className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-[var(--color-porcelain)] outline-none placeholder:text-[color-mix(in_oklab,var(--color-porcelain)_45%,transparent)] focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]"
        />
        <input type="text" tabIndex={-1} autoComplete="off" value={company} onChange={(e) => setCompany(e.target.value)} className="absolute -left-[9999px]" aria-hidden />
        <button type="submit" disabled={state === 'busy'} aria-label="Subscribe" className="grid w-12 shrink-0 place-items-center bg-[var(--color-gold-deep)] text-white transition-colors hover:bg-[var(--color-gold-soft)] hover:text-[var(--color-ink)] disabled:opacity-60">
          {state === 'busy' ? '…' : '→'}
        </button>
      </div>
      {state === 'error' && <p className="mt-2 text-xs text-[var(--color-blush)]">{msg}</p>}
      <p className="mt-2.5 text-[0.7rem] leading-relaxed text-[color-mix(in_oklab,var(--color-porcelain)_50%,transparent)]">
        By subscribing you agree to receive occasional updates. Unsubscribe any time. See our <a href="/info/privacy-policy" className="underline hover:text-[var(--color-gold-soft)]">privacy policy</a>.
      </p>
    </form>
  );
}
