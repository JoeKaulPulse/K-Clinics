'use client';

import { useEffect, useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';

type Passkey = { id: string; deviceName: string | null; createdAt: string; lastUsedAt: string | null };

// Lets any staff member enrol a platform passkey (Face ID / Touch ID / Windows
// Hello) for fast, phishing-resistant sign-in to the CRM.
export function PasskeyManager() {
  const [keys, setKeys] = useState<Passkey[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  async function load() {
    const j = await fetch('/api/admin/security/passkey').then((r) => r.json()).catch(() => ({ ok: false }));
    if (j.ok) setKeys(j.passkeys);
    setLoaded(true);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    setBusy('add'); setMsg('');
    try {
      const o = await fetch('/api/admin/security/passkey/register-options', { method: 'POST' }).then((r) => r.json());
      if (!o.ok) { setMsg(o.error || 'Could not start setup.'); return; }
      const resp = await startRegistration({ optionsJSON: o.options });
      const deviceName = (typeof navigator !== 'undefined' && navigator.platform) || 'This device';
      const v = await fetch('/api/admin/security/passkey/register-verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ response: resp, deviceName }) }).then((r) => r.json());
      if (v.ok) { setMsg('Passkey added ✓ — you can now sign in with Face ID / Touch ID.'); load(); } else setMsg(v.error || 'Could not add passkey.');
    } catch { setMsg('Setup was cancelled.'); } finally { setBusy(''); }
  }

  async function remove(id: string) {
    if (!confirm('Remove this passkey from your account?')) return;
    await fetch('/api/admin/security/passkey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'remove', id }) });
    load();
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl">Face ID / Touch ID sign-in</h2>
          <p className="mt-1 max-w-xl text-sm text-[var(--color-stone)]">Sign in to the CRM with your face or fingerprint — faster than a password and phishing-resistant. Set one up on each device you use.</p>
        </div>
        <button onClick={add} disabled={busy === 'add'} className="rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy === 'add' ? 'Setting up…' : '+ Add this device'}</button>
      </div>

      <div className="mt-4">
        {!loaded ? (
          <p className="text-xs text-[var(--color-stone-soft)]">Loading…</p>
        ) : keys.length ? (
          <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span>{k.deviceName || 'Passkey'}<span className="ml-2 text-xs text-[var(--color-stone-soft)]">added {new Date(k.createdAt).toLocaleDateString('en-GB')}{k.lastUsedAt ? ` · last used ${new Date(k.lastUsedAt).toLocaleDateString('en-GB')}` : ''}</span></span>
                <button onClick={() => remove(k.id)} className="text-xs text-[var(--color-blush)] hover:underline">Remove</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--color-stone)]">No passkey yet. Add this device to enable Face ID / Touch ID sign-in.</p>
        )}
      </div>
      {msg && <p className="mt-3 text-sm text-[var(--color-stone)]">{msg}</p>}
    </section>
  );
}
