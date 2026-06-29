'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { startAuthentication } from '@simplewebauthn/browser';

export function FinanceUnlock({ hasPin, next }: { hasPin: boolean; next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<'unlock' | 'set'>(hasPin ? 'unlock' : 'set');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function passkeyUnlock() {
    setErr(''); setBusy(true);
    try {
      const o = await fetch('/api/admin/security/passkey/auth-options', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ purpose: 'finance' }) }).then((r) => r.json());
      if (!o.ok) { setErr(o.error || 'No passkey available — use your PIN.'); return; }
      const resp = await startAuthentication({ optionsJSON: o.options });
      const v = await fetch('/api/admin/security/passkey/auth-verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ purpose: 'finance', response: resp }) }).then((r) => r.json());
      if (!v.ok) { setErr(v.error || 'Verification failed.'); return; }
      router.replace(next || '/admin/reports'); router.refresh();
    } catch {
      setErr('Passkey verification was cancelled.');
    } finally { setBusy(false); }
  }

  async function submit() {
    setErr('');
    if (!/^\d{6}$/.test(pin)) { setErr('Enter your 6-digit PIN.'); return; }
    if (mode === 'set' && pin !== confirm) { setErr('The two PINs don’t match.'); return; }
    setBusy(true);
    const body = mode === 'set' ? { op: 'set', pin } : { pin };
    const r = await fetch('/api/admin/finance/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((x) => x.json()).catch(() => ({ ok: false }));
    setBusy(false);
    if (r.ok) { router.replace(next || '/admin/reports'); router.refresh(); }
    else if (r.needsSetup) { setMode('set'); setErr('Set a 6-digit PIN to protect financial data.'); }
    else setErr(r.error || 'Could not unlock.');
  }

  return (
    <div className="mx-auto max-w-sm rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-7 text-center shadow-[var(--shadow-soft)]">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[var(--color-ink)] text-[var(--color-gold-soft)]">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
      </div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl">{mode === 'set' ? 'Set your financial PIN' : 'Financial data is locked'}</h1>
      <p className="mt-2 text-sm text-[var(--color-stone)]">
        {mode === 'set' ? 'Choose a 6-digit PIN. You’ll enter it to view reports, cashflow and revenue. It unlocks for 30 minutes.' : 'Enter your 6-digit PIN to view reports, cashflow and revenue for the next 30 minutes.'}
      </p>
      <input
        value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric" autoFocus type="password"
        placeholder="••••••"
        className="mt-5 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-[var(--color-gold)]"
      />
      {mode === 'set' && (
        <input
          value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric" type="password" placeholder="Confirm PIN"
          className="mt-3 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-[var(--color-gold)]"
        />
      )}
      {err && <p role="alert" aria-live="assertive" className="mt-3 text-sm text-[var(--color-blush)]">{err}</p>}
      <button onClick={submit} disabled={busy} className="mt-5 w-full rounded-full bg-[var(--color-ink)] px-6 py-3 text-sm font-medium text-[var(--color-porcelain)] disabled:opacity-50">
        {busy ? 'Please wait…' : mode === 'set' ? 'Set PIN & unlock' : 'Unlock'}
      </button>
      {mode === 'unlock' && (
        <>
          <div className="my-4 flex items-center gap-3 text-xs text-[var(--color-stone)]"><span className="h-px flex-1 bg-[var(--color-line)]" />or<span className="h-px flex-1 bg-[var(--color-line)]" /></div>
          <button onClick={passkeyUnlock} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full border border-[var(--color-line)] bg-white px-6 py-3 text-sm font-medium text-[var(--color-ink)] disabled:opacity-50">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 19a6.5 6.5 0 0 1 11.2-4.5M16 14l4.5 4.5M20.5 14 16 18.5" /></svg>
            Use Face ID / passkey
          </button>
        </>
      )}
      <p className="mt-4 text-xs text-[var(--color-stone)]">Keep your PIN private — it protects clinic financials.</p>
    </div>
  );
}
