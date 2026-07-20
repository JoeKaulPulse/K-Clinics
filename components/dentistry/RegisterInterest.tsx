'use client';

import { useState } from 'react';

export function RegisterInterest({ className = '' }: { className?: string }) {
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState(''); // honeypot
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/\S+@\S+\.\S+/.test(email)) { setState('error'); setMsg('Please enter a valid email address.'); return; }
    setState('busy'); setMsg('');
    try {
      const res = await fetch('/api/dentistry-interest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, company }) });
      const j = await res.json().catch(() => ({ ok: false }));
      if (j.ok) { setState('done'); setEmail(''); }
      else { setState('error'); setMsg(j.error || 'Something went wrong.'); }
    } catch { setState('error'); setMsg('Network error. Please try again.'); }
  }

  if (state === 'done') {
    return <p className={`rounded-[var(--radius-md)] border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/10 px-5 py-4 text-sm text-[var(--color-ink)] ${className}`}>Thank you — we’ll be in touch the moment our dentistry suite opens.</p>;
  }

  return (
    <form onSubmit={submit} noValidate className={className}>
      <div className="flex max-w-md overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] focus-within:border-[var(--color-gold)]">
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (state === 'error') setState('idle'); }}
          placeholder="Your email address"
          aria-label="Your email address"
          className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-stone)] focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]"
        />
        <input type="text" tabIndex={-1} autoComplete="off" value={company} onChange={(e) => setCompany(e.target.value)} className="absolute -left-[9999px]" aria-hidden />
        <button type="submit" disabled={state === 'busy'} className="shrink-0 bg-[var(--color-ink)] px-5 text-sm font-medium text-[var(--color-porcelain)] transition-colors hover:bg-[var(--color-gold-deep)] hover:text-white disabled:opacity-60">
          {state === 'busy' ? '…' : 'Notify me'}
        </button>
      </div>
      {state === 'error' && <p className="mt-2 text-xs text-[var(--color-blush-deep)]">{msg}</p>}
      <p className="mt-2.5 text-xs text-[var(--color-stone)]">We’ll only email you about our dentistry launch. Unsubscribe any time.</p>
    </form>
  );
}
