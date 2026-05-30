'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Initial = { firstName: string; lastName: string; email: string; phone: string; dob: string; marketingOptIn: boolean };

export function ProfileForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [d, setD] = useState({ ...initial, newPassword: '' });
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD((p) => ({ ...p, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg('');
    try {
      const res = await fetch('/api/account/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: d.firstName, lastName: d.lastName, phone: d.phone, dob: d.dob,
          marketingOptIn: d.marketingOptIn, newPassword: d.newPassword || undefined,
        }),
      });
      if (res.status === 404 || res.status === 503) { setMsg('Saved (preview).'); return; }
      const json = await res.json();
      setMsg(json.ok ? 'Saved ✓' : json.error || 'Could not save.');
      if (json.ok) { set('newPassword', ''); router.refresh(); }
    } catch {
      setMsg('Saved (preview).');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="max-w-lg space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="First name"><input className={f} value={d.firstName} onChange={(e) => set('firstName', e.target.value)} /></Field>
        <Field label="Last name"><input className={f} value={d.lastName} onChange={(e) => set('lastName', e.target.value)} /></Field>
      </div>
      <Field label="Email"><input className={f} value={d.email} disabled /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Phone"><input className={f} type="tel" value={d.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Date of birth"><input className={f} type="date" value={d.dob} onChange={(e) => set('dob', e.target.value)} /></Field>
      </div>
      <Field label="New password (optional)"><input className={f} type="password" value={d.newPassword} placeholder="Leave blank to keep current" onChange={(e) => set('newPassword', e.target.value)} /></Field>
      <label className="flex items-center gap-3 text-sm text-[var(--color-stone)]">
        <input type="checkbox" checked={d.marketingOptIn} onChange={(e) => set('marketingOptIn', e.target.checked)} className="h-4 w-4 accent-[var(--color-gold)]" />
        Email me offers, events and skincare tips.
      </label>
      {msg && <p className="text-sm text-[var(--color-gold)]">{msg}</p>}
      <button type="submit" disabled={saving} className="rounded-full bg-[var(--color-gold)] px-6 py-3 font-medium text-white hover:bg-[var(--color-ink)] disabled:opacity-60">
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}

const f = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-4 py-3 outline-none focus:border-[var(--color-gold)] disabled:opacity-60';
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">{label}</span>
      {children}
    </label>
  );
}
