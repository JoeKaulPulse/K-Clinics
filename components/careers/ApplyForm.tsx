'use client';

import { useState } from 'react';
import { Button, ArrowIcon } from '@/components/ui/Button';

const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 py-3 text-[var(--color-ink)] outline-none focus:border-[var(--color-gold)]';
const label = 'mb-1.5 block text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]';

export function ApplyForm({ roles }: { roles: { id: string; title: string }[] }) {
  const [f, setF] = useState({ vacancyId: roles[0]?.id ?? '', name: '', email: '', phone: '', cvUrl: '', coverNote: '', company: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const roleTitle = roles.find((r) => r.id === f.vacancyId)?.title || 'General application';

  async function submit() {
    if (!f.name.trim() || !/\S+@\S+\.\S+/.test(f.email)) { setError('Please enter your name and a valid email.'); return; }
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/careers/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, vacancyId: f.vacancyId || undefined, roleTitle }) });
      const j = await res.json();
      if (j.ok) setDone(true); else setError(j.error || 'Could not submit your application.');
    } catch { setError('Network error. Please try again.'); }
    finally { setBusy(false); }
  }

  if (done) {
    return (
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[var(--color-ink)] text-[var(--color-gold-soft)]"><svg viewBox="0 0 24 24" className="h-6 w-6" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
        <h3 className="font-[family-name:var(--font-display)] text-2xl">Application received</h3>
        <p className="mx-auto mt-3 max-w-md text-[var(--color-stone)]">Thank you — we’ve received your application for <strong>{roleTitle}</strong>. If it’s a match, our team will be in touch.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-6 md:p-8">
      <h3 className="font-[family-name:var(--font-display)] text-2xl">Apply</h3>
      <p className="mt-1 text-sm text-[var(--color-stone)]">Tell us about you. We review every application personally.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><label htmlFor="apply-role" className={label}>Role</label>
          <select id="apply-role" className={field} value={f.vacancyId} onChange={(e) => set('vacancyId', e.target.value)}>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            <option value="">General / speculative application</option>
          </select>
        </div>
        <div><label htmlFor="apply-name" className={label}>Full name *</label><input id="apply-name" className={field} value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
        <div><label htmlFor="apply-email" className={label}>Email *</label><input id="apply-email" type="email" className={field} value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
        <div><label htmlFor="apply-phone" className={label}>Phone</label><input id="apply-phone" type="tel" className={field} value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>
        <div><label htmlFor="apply-cv" className={label}>CV / portfolio link</label><input id="apply-cv" className={field} value={f.cvUrl} onChange={(e) => set('cvUrl', e.target.value)} placeholder="https://…" /></div>
        <div className="sm:col-span-2"><label htmlFor="apply-cover" className={label}>Cover note</label><textarea id="apply-cover" rows={4} className={field} value={f.coverNote} onChange={(e) => set('coverNote', e.target.value)} placeholder="Why you, why KClinics…" /></div>
        <input type="text" tabIndex={-1} autoComplete="off" value={f.company} onChange={(e) => set('company', e.target.value)} className="absolute -left-[9999px] h-0 w-0" aria-hidden />
      </div>
      {error && <p className="mt-4 rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-4 py-3 text-sm text-[var(--color-ink)]">{error}</p>}
      <div className="mt-6"><Button onClick={() => !busy && submit()} variant="gold" size="lg">{busy ? 'Submitting…' : 'Submit application'} <ArrowIcon /></Button></div>
    </div>
  );
}
