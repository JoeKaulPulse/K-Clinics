'use client';

import { useState } from 'react';
import { Button, ArrowIcon } from '@/components/ui/Button';

type Cohort = { id: string; label: string };

const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 py-3 text-[var(--color-ink)] outline-none focus:border-[var(--color-gold)]';
const label = 'mb-1.5 block text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]';

export function ApplyForm({ courseId, courseTitle, cohorts }: { courseId: string; courseTitle: string; cohorts: Cohort[] }) {
  const [f, setF] = useState({ name: '', email: '', phone: '', cohortId: '', experience: '', financeInterest: false, company: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  async function submit() {
    if (!f.name.trim() || !/\S+@\S+\.\S+/.test(f.email)) { setError('Please enter your name and a valid email.'); return; }
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/academy/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, courseId }) });
      const j = await res.json();
      if (j.ok) setDone(true); else setError(j.error || 'Could not submit your application.');
    } catch { setError('Network error. Please try again.'); }
    finally { setBusy(false); }
  }

  if (done) {
    return (
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[var(--color-ink)] text-[var(--color-gold-soft)]">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <h3 className="font-[family-name:var(--font-display)] text-2xl">Application received</h3>
        <p className="mx-auto mt-3 max-w-md text-[var(--color-stone)]">Thank you — our team will be in touch shortly to confirm your place on <strong>{courseTitle}</strong> and talk through dates{f.financeInterest ? ' and Clearpay financing' : ''}.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-6 md:p-8">
      <h3 className="font-[family-name:var(--font-display)] text-2xl">Apply for this course</h3>
      <p className="mt-1 text-sm text-[var(--color-stone)]">Tell us a little about you and we’ll confirm your place and next steps.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className={label}>Full name *</label><input className={field} value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
        <div><label className={label}>Email *</label><input type="email" className={field} value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
        <div><label className={label}>Phone</label><input type="tel" className={field} value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>
        {cohorts.length > 0 && (
          <div className="sm:col-span-2"><label className={label}>Preferred start date</label>
            <select className={field} value={f.cohortId} onChange={(e) => set('cohortId', e.target.value)}>
              <option value="">No preference</option>
              {cohorts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
        )}
        <div className="sm:col-span-2"><label className={label}>Your background / experience</label><textarea rows={3} className={field} value={f.experience} onChange={(e) => set('experience', e.target.value)} placeholder="Current qualifications, clinical/beauty experience, goals…" /></div>
        <input type="text" tabIndex={-1} autoComplete="off" value={f.company} onChange={(e) => set('company', e.target.value)} className="absolute -left-[9999px] h-0 w-0" aria-hidden />
        <label className="flex items-start gap-3 text-sm text-[var(--color-stone)] sm:col-span-2">
          <input type="checkbox" checked={f.financeInterest} onChange={(e) => set('financeInterest', e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--color-gold)]" />
          I’d like to spread the cost with Clearpay financing.
        </label>
      </div>
      {error && <p className="mt-4 rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-4 py-3 text-sm text-[var(--color-ink)]">{error}</p>}
      <div className="mt-6"><Button onClick={() => !busy && submit()} variant="gold" size="lg">{busy ? 'Submitting…' : 'Submit application'} <ArrowIcon /></Button></div>
    </div>
  );
}
