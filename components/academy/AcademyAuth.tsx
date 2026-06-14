'use client';

import { useState } from 'react';
import { Button, ArrowIcon } from '@/components/ui/Button';

const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 py-3 text-[var(--color-ink)] outline-none focus:border-[var(--color-gold)]';
const label = 'mb-1.5 block text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]';

export function AcademyAuth() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', phone: '', dob: '', password: '', ageDeclare: false, company: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  async function submit() {
    setBusy(true); setError('');
    const url = mode === 'signup' ? '/api/academy/account/signup' : '/api/academy/account/login';
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
      const j = await res.json();
      if (j.ok) window.location.reload();
      else { setError(j.error || 'Something went wrong.'); setBusy(false); }
    } catch { setError('Network error. Please try again.'); setBusy(false); }
  }

  async function passkeyLogin() {
    setBusy(true); setError('');
    try {
      const { startAuthentication } = await import('@simplewebauthn/browser');
      const opt = await fetch('/api/academy/passkey/auth-options', { method: 'POST' }).then((r) => r.json());
      if (!opt.ok) throw new Error(opt.error || 'Could not start.');
      const response = await startAuthentication({ optionsJSON: opt.options });
      const v = await fetch('/api/academy/passkey/auth-verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ response }) }).then((r) => r.json());
      if (v.ok) window.location.reload();
      else { setError(v.error || 'Passkey sign-in failed.'); setBusy(false); }
    } catch (e) {
      const msg = (e as Error)?.message || '';
      setError(/NotAllowed|abort|cancel/i.test(msg) ? 'Sign-in cancelled.' : 'No passkey on this device yet — sign in with your password, then enable Face ID in Settings.');
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-6 md:p-8">
      <h2 className="font-[family-name:var(--font-display)] text-2xl">{mode === 'signup' ? 'Create your trainee account' : 'Trainee login'}</h2>
      <p className="mt-1 text-sm text-[var(--color-stone)]">{mode === 'signup' ? 'Track your enrolment, access theory and see your practical dates.' : 'Welcome back to K Academy.'}</p>
      <div className="mt-6 space-y-4">
        {mode === 'signup' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className={label}>First name *</label><input className={field} value={f.firstName} onChange={(e) => set('firstName', e.target.value)} /></div>
            <div><label className={label}>Last name</label><input className={field} value={f.lastName} onChange={(e) => set('lastName', e.target.value)} /></div>
          </div>
        )}
        <div><label className={label}>Email *</label><input type="email" className={field} value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
        {mode === 'signup' && <div><label className={label}>Phone</label><input type="tel" className={field} value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>}
        {mode === 'signup' && <div><label className={label}>Date of birth *</label><input type="date" className={field} value={f.dob} onChange={(e) => set('dob', e.target.value)} /></div>}
        <div><label className={label}>Password{mode === 'signup' ? ' (8+ characters) *' : ' *'}</label><input type="password" className={field} value={f.password} onChange={(e) => set('password', e.target.value)} /></div>
        {mode === 'signup' && (
          <label className="flex items-start gap-3 text-sm text-[var(--color-stone)]">
            <input type="checkbox" checked={f.ageDeclare} onChange={(e) => set('ageDeclare', e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-gold)]" />
            I confirm I am 16 years of age or older.
          </label>
        )}
        <input type="text" tabIndex={-1} autoComplete="off" value={f.company} onChange={(e) => set('company', e.target.value)} className="absolute -left-[9999px] h-0 w-0" aria-hidden />
        {mode === 'login' && (
          <button type="button" onClick={() => !busy && passkeyLogin()} className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 py-3 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-gold)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 11v4M9 11V8a3 3 0 0 1 6 0v3" /><rect x="5" y="11" width="14" height="9" rx="2" /></svg>
            Sign in with Face ID / fingerprint
          </button>
        )}
      </div>
      {error && <p className="mt-4 rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-4 py-3 text-sm text-[var(--color-ink)]">{error}</p>}
      <div className="mt-6 flex items-center justify-between gap-4">
        <button type="button" onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); }} className="text-sm font-medium text-[var(--color-stone)] hover:text-[var(--color-ink)]">
          {mode === 'signup' ? 'Already registered? Sign in' : 'New here? Create an account'}
        </button>
        <Button onClick={() => !busy && submit()} variant="gold">{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'} <ArrowIcon /></Button>
      </div>
    </div>
  );
}
