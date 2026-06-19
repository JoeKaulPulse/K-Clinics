'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authField, authLabel, authButton } from '@/components/portal/AuthShell';
import { FormStagger, FormField, SubmitFeedback, SubmitButton } from '@/components/portal/FormMotion';
import { Reveal } from '@/components/motion/Reveal';

export function ResetPasswordForm() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get('id') || '';
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const missing = !id || !token;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) return setError('Passwords don’t match.');
    if (password.length < 8) return setError('Use at least 8 characters.');
    setLoading(true);
    try {
      const res = await fetch('/api/account/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, token, password }),
      });
      const json = await res.json().catch(() => ({ ok: false, error: 'Unexpected response.' }));
      if (json.ok) {
        router.push('/account');
        router.refresh();
      } else {
        setError(json.error || 'Could not reset your password.');
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (missing) {
    return (
      <Reveal y={16}>
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-6">
          <p className="font-medium">Invalid reset link</p>
          <p className="mt-2 text-sm text-[var(--color-stone)]">This link is incomplete or has expired.</p>
          <Link href="/account/forgot-password" className="mt-4 inline-block text-sm font-medium text-[var(--color-gold-deep)]">Request a new link</Link>
        </div>
      </Reveal>
    );
  }

  return (
    <FormStagger onSubmit={submit} className="space-y-5">
      <FormField>
        <label className={authLabel} htmlFor="pw">New password</label>
        <input id="pw" type="password" autoComplete="new-password" required minLength={8} className={authField} value={password} onChange={(e) => setPassword(e.target.value)} />
      </FormField>
      <FormField>
        <label className={authLabel} htmlFor="cf">Confirm password</label>
        <input id="cf" type="password" autoComplete="new-password" required className={authField} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </FormField>
      <FormField className="space-y-4">
        <SubmitFeedback message={error} tone="error" />
        <SubmitButton pending={loading} pendingLabel="Saving…" className={authButton}>Set new password</SubmitButton>
      </FormField>
    </FormStagger>
  );
}
