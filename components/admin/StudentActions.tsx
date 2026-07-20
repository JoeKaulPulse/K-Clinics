'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

async function post(payload: object) {
  return fetch('/api/admin/academy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

// BLD-528: staff account actions for one trainee — suspend/reactivate, email a
// passwordless portal link (for accounts created during an offer), or trigger a
// password reset email.
export function StudentActions({ studentId, email, portalActive, hasClient }: { studentId: string; email: string; portalActive: boolean; hasClient: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [done, setDone] = useState('');
  async function act(op: string, payload: object, label: string, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(label); setDone('');
    await post({ op, ...payload });
    setBusy(''); setDone(label);
    router.refresh();
    setTimeout(() => setDone(''), 4000);
  }
  const btn = 'rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] disabled:opacity-50';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => act('setStudentActive', { id: studentId, active: !portalActive }, portalActive ? 'Suspended' : 'Reactivated', portalActive ? 'Suspend this trainee’s portal access?' : undefined)}
        disabled={!!busy}
        className={portalActive ? `${btn} hover:!border-[var(--color-blush)] hover:!text-[var(--color-blush-deep)]` : 'rounded-full border border-[var(--color-gold)] px-4 py-1.5 text-sm text-[var(--color-gold)]'}
      >{portalActive ? 'Suspend access' : 'Reactivate'}</button>
      <button onClick={() => act('sendActivation', { studentId }, 'Access link sent')} disabled={!!busy} className={btn}>Email portal link</button>
      <button onClick={() => act('resetStudentPassword', { email }, 'Reset email sent')} disabled={!!busy} className={btn}>Send password reset</button>
      {!hasClient && <button onClick={() => act('linkClient', { studentId }, 'Client linked')} disabled={!!busy} className={btn}>Link clinic client</button>}
      {busy && <span className="text-xs text-[var(--color-stone)]">Working…</span>}
      {done && <span className="text-xs text-[var(--color-gold)]">{done} ✓</span>}
    </div>
  );
}
