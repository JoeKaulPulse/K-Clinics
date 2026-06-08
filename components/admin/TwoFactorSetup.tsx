'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

async function post(payload: object) {
  const r = await fetch('/api/admin/2fa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return r.json().catch(() => ({ ok: false }));
}

export function TwoFactorSetup({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [stage, setStage] = useState<'idle' | 'enrol' | 'codes'>('idle');
  const [secret, setSecret] = useState('');
  const [uri, setUri] = useState('');
  const [qr, setQr] = useState('');
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function begin() {
    setBusy(true); setErr('');
    const r = await post({ op: 'begin' });
    setBusy(false);
    if (r.ok) { setSecret(r.secret); setUri(r.uri); setQr(r.qr || ''); setStage('enrol'); } else setErr(r.error || 'Could not start setup.');
  }
  async function confirm() {
    setBusy(true); setErr('');
    const r = await post({ op: 'confirm', code });
    setBusy(false);
    if (r.ok) { setCodes(r.recoveryCodes || []); setStage('codes'); } else setErr(r.error || 'Invalid code.');
  }
  async function disable() {
    if (!confirm) return;
    if (!window.confirm('Turn off two-factor authentication for your account?')) return;
    setBusy(true);
    await post({ op: 'disable' });
    setBusy(false); router.refresh();
  }

  if (enabled && stage === 'idle') {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
        <h3 className="font-[family-name:var(--font-display)] text-lg">Two-factor authentication</h3>
        <p className="mt-1 inline-flex items-center gap-2 text-sm text-emerald-700"><span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-600 text-[0.6rem] text-white">✓</span> Enabled — your account is protected with an authenticator app.</p>
        <button onClick={disable} disabled={busy} className="mt-4 text-sm text-[var(--color-blush)] hover:underline disabled:opacity-50">Turn off 2FA</button>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <h3 className="font-[family-name:var(--font-display)] text-lg">Two-factor authentication</h3>

      {stage === 'idle' && (
        <>
          <p className="mt-1 text-sm text-[var(--color-stone)]">Add a second layer of protection with an authenticator app (Google Authenticator, Authy, 1Password…).</p>
          <button onClick={begin} disabled={busy} className="mt-4 rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Please wait…' : 'Set up 2FA'}</button>
        </>
      )}

      {stage === 'enrol' && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-[var(--color-stone)]">1. In your authenticator app, add an account and scan this QR code:</p>
          {qr
            ? <img src={qr} alt="2FA QR code" width={196} height={196} className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white p-2" />
            : <p className="text-xs text-[var(--color-stone-soft)]">(QR unavailable — use the setup key below.)</p>}
          <p className="text-sm text-[var(--color-stone)]">…or enter this setup key manually:</p>
          <code className="block break-all rounded-[var(--radius-sm)] bg-[var(--color-bone)] px-3 py-2 text-sm tracking-wider">{secret}</code>
          <p className="text-xs text-[var(--color-stone-soft)]">On a phone you can also tap <a href={uri} className="link-underline">this link</a> to add it automatically.</p>
          <label className="block text-sm text-[var(--color-stone)]">2. Enter the 6-digit code it shows:
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="123456" className="mt-1 w-40 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" />
          </label>
          {err && <p className="text-sm text-[var(--color-blush)]">{err}</p>}
          <div className="flex gap-2">
            <button onClick={confirm} disabled={busy} className="rounded-full bg-[var(--color-gold)] px-5 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Verifying…' : 'Verify & enable'}</button>
            <button onClick={() => setStage('idle')} className="px-3 py-2 text-sm text-[var(--color-stone)]">Cancel</button>
          </div>
        </div>
      )}

      {stage === 'codes' && (
        <div className="mt-3 space-y-3">
          <p className="text-sm font-medium text-emerald-700">✓ Two-factor authentication is on.</p>
          <p className="text-sm text-[var(--color-ink)]">Save these <strong>recovery codes</strong> somewhere safe. Each works once if you lose your authenticator:</p>
          <div className="grid grid-cols-2 gap-2 rounded-[var(--radius-sm)] bg-[var(--color-bone)] p-4 font-[family-name:var(--font-mono,monospace)] text-sm">
            {codes.map((c) => <span key={c}>{c}</span>)}
          </div>
          <button onClick={() => { router.refresh(); }} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)]">I’ve saved them</button>
        </div>
      )}

      {err && stage === 'idle' && <p className="mt-2 text-sm text-[var(--color-blush)]">{err}</p>}
    </div>
  );
}
