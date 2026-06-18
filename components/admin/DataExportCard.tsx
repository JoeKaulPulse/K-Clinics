'use client';

import { useEffect, useState } from 'react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

type Passkey = { id: string; deviceName: string | null; createdAt: string; lastUsedAt: string | null };

// Full-database backup/export, gated behind a passkey (Face ID / Touch ID /
// Windows Hello) step-up. OWNER-only server-side; this card is owner-only too.
export function DataExportCard() {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  async function loadPasskeys() {
    const j = await fetch('/api/admin/security/passkey').then((r) => r.json()).catch(() => ({ ok: false }));
    if (j.ok) setPasskeys(j.passkeys);
    setLoaded(true);
  }
  useEffect(() => { loadPasskeys(); }, []);

  async function registerPasskey() {
    setBusy('register'); setMsg('');
    try {
      const o = await fetch('/api/admin/security/passkey/register-options', { method: 'POST' }).then((r) => r.json());
      if (!o.ok) { setMsg(o.error || 'Could not start setup.'); return; }
      const resp = await startRegistration({ optionsJSON: o.options });
      const deviceName = (typeof navigator !== 'undefined' && navigator.platform) || 'This device';
      const v = await fetch('/api/admin/security/passkey/register-verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ response: resp, deviceName }),
      }).then((r) => r.json());
      if (v.ok) { setMsg('Passkey registered ✓'); loadPasskeys(); } else setMsg(v.error || 'Could not register.');
    } catch {
      setMsg('Passkey setup was cancelled.');
    } finally { setBusy(''); }
  }

  async function removePasskey(id: string) {
    if (!confirm('Remove this passkey? You’ll need another to export data.')) return;
    await fetch('/api/admin/security/passkey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'remove', id }) });
    loadPasskeys();
  }

  async function unlockAndDownload() {
    if (!confirm('Download a full backup of ALL clinic data? This file contains sensitive personal and clinical data — store it securely.')) return;
    setBusy('export'); setMsg('Verifying with your passkey…');
    try {
      const o = await fetch('/api/admin/security/passkey/auth-options', { method: 'POST' }).then((r) => r.json());
      if (!o.ok) { setMsg(o.error || 'Could not start verification.'); return; }
      const resp = await startAuthentication({ optionsJSON: o.options });
      const v = await fetch('/api/admin/security/passkey/auth-verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ response: resp }),
      }).then((r) => r.json());
      if (!v.ok) { setMsg(v.error || 'Verification failed.'); return; }
      setMsg('Verified ✓ — your download is starting.');
      window.location.href = '/api/admin/export';
    } catch {
      setMsg('Verification was cancelled.');
    } finally { setBusy(''); }
  }

  const hasPasskey = passkeys.length > 0;

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <h2 className="font-[family-name:var(--font-display)] text-xl">Data export &amp; backup</h2>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">
        Download a complete, restorable snapshot of every record — clients, bookings, consultations, health &amp; consent
        forms, finance, loyalty, gift cards, campaigns, content and more. For backups or migrating to a new environment.
      </p>
      <p className="mt-2 max-w-2xl text-sm text-[var(--color-stone)]">
        Because this file contains all personal and clinical data, the download is locked behind a <strong>passkey</strong>
        {' '}(Face ID, Touch ID or Windows Hello) — so even a stolen session or leaked key can’t pull the data without your
        device and biometric.
      </p>

      {/* Registered passkeys */}
      <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Your passkeys</p>
          <button onClick={registerPasskey} disabled={busy === 'register'} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs hover:border-[var(--color-gold)] disabled:opacity-50">
            {busy === 'register' ? 'Setting up…' : '+ Add a passkey'}
          </button>
        </div>
        {!loaded ? (
          <p className="mt-2 text-xs text-[var(--color-stone)]">Loading…</p>
        ) : hasPasskey ? (
          <ul className="mt-2 divide-y divide-[var(--color-line)]">
            {passkeys.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span>{p.deviceName || 'Passkey'}<span className="ml-2 text-xs text-[var(--color-stone)]">added {new Date(p.createdAt).toLocaleDateString('en-GB')}{p.lastUsedAt ? ` · last used ${new Date(p.lastUsedAt).toLocaleDateString('en-GB')}` : ''}</span></span>
                <button onClick={() => removePasskey(p.id)} className="text-xs text-[var(--color-blush)] hover:underline">Remove</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-[var(--color-stone)]">No passkey yet. Add one on this device to enable exports.</p>
        )}
      </div>

      <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-[var(--color-stone)]">
        <li>Restores into a PostgreSQL database built from the same schema.</li>
        <li>Encrypted fields export as ciphertext — migrate the encryption keys (env vars) too.</li>
        <li>Uploaded media live in Vercel Blob; this export includes their URLs — copy the Blob store separately.</li>
      </ul>

      <button onClick={unlockAndDownload} disabled={!hasPasskey || busy === 'export'} className="mt-5 rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm text-[var(--color-porcelain)] disabled:opacity-50" title={hasPasskey ? '' : 'Add a passkey first'}>
        {busy === 'export' ? 'Verifying…' : 'Verify &amp; download full backup'}
      </button>
      {msg && <p className="mt-3 text-sm text-[var(--color-stone)]">{msg}</p>}
    </section>
  );
}
