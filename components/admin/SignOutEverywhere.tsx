'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function SignOutEverywhere() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!window.confirm('Sign out of every device, including this one? You’ll need to sign in again.')) return;
    setBusy(true);
    await fetch('/api/admin/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'signOutEverywhere' }) }).catch(() => {});
    router.push('/admin/login');
    router.refresh();
  }
  return (
    <button onClick={go} disabled={busy} className="text-sm text-[var(--color-blush-deep)] hover:underline disabled:opacity-50">
      {busy ? 'Signing out…' : 'Sign out of all devices'}
    </button>
  );
}
