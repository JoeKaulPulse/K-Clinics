'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isMascotMuted, setMascotMuted, mascotBlip } from '@/components/academy/mascotVoice';

type Passkey = { id: string; name: string; createdAt: string; lastUsedAt: string | null };
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export function AcademySettings({ passkeys: initial }: { passkeys: Passkey[] }) {
  const router = useRouter();
  const [muted, setMuted] = useState(false);
  const [passkeys, setPasskeys] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => setMuted(isMascotMuted()), []);

  function toggleVoice() {
    const m = !muted;
    setMascotMuted(m); setMuted(m);
    if (!m) mascotBlip('cheer'); // little preview when turning it on
  }

  async function addPasskey() {
    setBusy(true); setMsg('');
    try {
      const { startRegistration } = await import('@simplewebauthn/browser');
      const opt = await fetch('/api/academy/passkey/register-options', { method: 'POST' }).then((r) => r.json());
      if (!opt.ok) throw new Error(opt.error || 'Could not start.');
      const response = await startRegistration({ optionsJSON: opt.options });
      const deviceName = /iphone|ipad/i.test(navigator.userAgent) ? 'iPhone / iPad' : /android/i.test(navigator.userAgent) ? 'Android' : 'This device';
      const v = await fetch('/api/academy/passkey/register-verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ response, deviceName }) }).then((r) => r.json());
      if (v.ok) { setMsg('Face ID / fingerprint is set up. You can use it to sign in next time.'); router.refresh(); }
      else setMsg(v.error || 'Could not save the passkey.');
    } catch (e) {
      const m = (e as Error)?.message || '';
      setMsg(/NotAllowed|abort|cancel/i.test(m) ? 'Setup cancelled.' : 'This device doesn’t support a passkey, or it was cancelled.');
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!confirm('Remove this passkey?')) return;
    await fetch('/api/academy/passkey/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => {});
    setPasskeys((p) => p.filter((x) => x.id !== id));
    router.refresh();
  }

  return (
    <div className="mt-8 max-w-xl space-y-6">
      {/* Sound */}
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-[family-name:var(--font-display)] text-lg">K’s voice</p>
            <p className="mt-0.5 text-sm text-[var(--color-stone)]">A soft sound plays while K talks. Turn it off if you prefer silence.</p>
          </div>
          <button onClick={toggleVoice} role="switch" aria-checked={!muted} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${!muted ? 'bg-[var(--color-gold)]' : 'bg-[var(--color-line)]'}`}>
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${!muted ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>

      {/* Biometric sign-in */}
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5 sm:p-6">
        <p className="font-[family-name:var(--font-display)] text-lg">Face ID / fingerprint sign-in</p>
        <p className="mt-0.5 text-sm text-[var(--color-stone)]">Sign in to the academy with your face or fingerprint instead of a password. Your password still works too.</p>
        {passkeys.length > 0 && (
          <ul className="mt-4 space-y-2">
            {passkeys.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-4 py-2.5 text-sm">
                <span>{p.name}<span className="block text-xs text-[var(--color-stone)]">Added {fmt(p.createdAt)}{p.lastUsedAt ? ` · last used ${fmt(p.lastUsedAt)}` : ''}</span></span>
                <button onClick={() => remove(p.id)} className="text-xs text-[var(--color-blush)] hover:underline">Remove</button>
              </li>
            ))}
          </ul>
        )}
        <button onClick={addPasskey} disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm font-medium text-[var(--color-porcelain)] transition-colors hover:bg-[var(--color-espresso)] disabled:opacity-60">
          {busy ? 'Setting up…' : passkeys.length ? 'Add another device' : 'Set up Face ID / fingerprint'}
        </button>
        {msg && <p className="mt-3 text-sm text-[var(--color-stone)]">{msg}</p>}
      </div>
    </div>
  );
}
