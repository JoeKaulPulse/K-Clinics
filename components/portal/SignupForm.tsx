'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { authField, authLabel } from '@/components/portal/AuthShell';
import { IS_STATIC_DEMO } from '@/lib/static-demo';

export function SignupForm() {
  const router = useRouter();
  const [d, setD] = useState({ firstName: '', lastName: '', email: '', phone: '', dob: '', password: '', marketingOptIn: true, consent: false, company: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<null | { granted: boolean; code?: string; percent: number; reason?: string }>(null);

  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!d.consent) return setError('Please accept the terms to continue.');
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/account/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      });
      // 404 fakes success ONLY on the static GitHub Pages demo (no /api). On the
      // live site a 404 is a real failure — fall through to the error below.
      if (res.status === 404 && IS_STATIC_DEMO) {
        setDone({ granted: true, code: 'WELCOME15', percent: 15 });
        return;
      }
      const json = await res.json().catch(() => ({ ok: false, error: 'Unexpected response.' }));
      if (json.ok) {
        setDone(json.discount);
      } else {
        setError(json.error || 'Could not create your account.');
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 text-center">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-[var(--color-ink)] text-[var(--color-gold-soft)]">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <h2 className="font-[family-name:var(--font-display)] text-2xl">Welcome to KClinics, {d.firstName}.</h2>
        {done.granted ? (
          <p className="mx-auto mt-3 max-w-sm text-[var(--color-stone)]">
            Your <strong>{done.percent}% welcome discount</strong> is ready — code{' '}
            <span className="font-mono font-semibold text-[var(--color-gold-deep)]">{done.code}</span>. It’s saved to your account.
          </p>
        ) : (
          <p className="mx-auto mt-3 max-w-sm text-[var(--color-stone)]">{done.reason}</p>
        )}
        <button onClick={() => { router.push('/account'); router.refresh(); }} className="mt-6 rounded-full bg-[var(--color-gold-deep)] px-6 py-3 font-medium text-white hover:bg-[var(--color-ink)]">
          Go to my portal
        </button>
      </motion.div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" aria-label="Leave this field empty" value={d.company} onChange={(e) => set('company', e.target.value)} className="absolute -left-[9999px] h-0 w-0" />
      <div className="grid grid-cols-2 gap-4">
        <div><label className={authLabel} htmlFor="fn">First name</label><input id="fn" required className={authField} value={d.firstName} onChange={(e) => set('firstName', e.target.value)} /></div>
        <div><label className={authLabel} htmlFor="ln">Last name</label><input id="ln" className={authField} value={d.lastName} onChange={(e) => set('lastName', e.target.value)} /></div>
      </div>
      <div><label className={authLabel} htmlFor="em">Email</label><input id="em" type="email" autoComplete="email" required className={authField} value={d.email} onChange={(e) => set('email', e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className={authLabel} htmlFor="ph">Phone</label><input id="ph" type="tel" autoComplete="tel" className={authField} value={d.phone} onChange={(e) => set('phone', e.target.value)} /></div>
        <div><label className={authLabel} htmlFor="db">Date of birth</label><input id="db" type="date" className={authField} value={d.dob} onChange={(e) => set('dob', e.target.value)} /></div>
      </div>
      <div><label className={authLabel} htmlFor="pw">Create a password</label><input id="pw" type="password" autoComplete="new-password" required minLength={8} className={authField} value={d.password} onChange={(e) => set('password', e.target.value)} /></div>
      <label className="flex items-start gap-3 text-sm text-[var(--color-stone)]">
        <input type="checkbox" checked={d.marketingOptIn} onChange={(e) => set('marketingOptIn', e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-gold)]" />
        Send me offers, events and skincare tips.
      </label>
      <label className="flex items-start gap-3 text-sm text-[var(--color-stone)]">
        <input type="checkbox" checked={d.consent} onChange={(e) => set('consent', e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-gold)]" />
        I agree to the{' '}
        <Link href="/info/terms-conditions" className="underline">Terms</Link> &{' '}
        <Link href="/info/privacy-policy" className="underline">Privacy Policy</Link>.
      </label>
      {error && <p role="alert" aria-live="assertive" className="rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-4 py-2.5 text-sm text-[var(--color-ink)]">{error}</p>}
      <button type="submit" disabled={loading} className="w-full rounded-full bg-[var(--color-gold-deep)] px-6 py-3.5 font-medium text-white shadow-[var(--shadow-gold)] transition-colors hover:bg-[var(--color-ink)] disabled:opacity-60">
        {loading ? 'Creating your account…' : 'Create account & claim 15% off'}
      </button>
      <p className="text-center text-sm text-[var(--color-stone)]">
        Already have an account?{' '}
        <Link href="/account/login" className="font-medium text-[var(--color-gold-deep)]">Sign in</Link>
      </p>
    </form>
  );
}
