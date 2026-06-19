'use client';

import { useState, type FormEvent } from 'react';
import { site } from '@/lib/site';
import { Button, ArrowIcon } from '@/components/ui/Button';

/** Group & event enquiry (birthdays, hen parties, corporate, bridal) — recorded
 *  via /api/consult so it lands in the CRM and notifies the front desk. */
export function GroupBookingForm() {
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) || '').trim();
    const name = get('name'); const company = get('company');
    setBusy(true);
    try {
      const [firstName, ...rest] = (name || 'Group enquiry').split(/\s+/);
      const message = [
        'Group / event booking enquiry',
        get('occasion') ? `Occasion: ${get('occasion')}` : '',
        get('size') ? `Group size: ${get('size')}` : '',
        get('date') ? `Preferred date: ${get('date')}` : '',
        get('treatments') ? `Treatments of interest: ${get('treatments')}` : '',
        '',
        get('message'),
      ].filter(Boolean).join('\n');
      const res = await fetch('/api/consult', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: firstName || 'Group', lastName: rest.join(' ') || undefined, email: get('email'), phone: get('phone') || undefined, category: 'general', message, consent: true, company }),
      });
      const j = await res.json().catch(() => ({ ok: false }));
      setStatus(j.ok ? 'sent' : 'error');
    } catch { setStatus('error'); } finally { setBusy(false); }
  }

  const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 py-3 text-[var(--color-ink)] outline-none transition-colors placeholder:text-[var(--color-stone)] focus:border-[var(--color-gold)]';
  const label = 'mb-1.5 block text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]';

  if (status === 'sent') {
    return (
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 text-center">
        <h3 className="font-[family-name:var(--font-display)] text-2xl">Thank you — we’d love to host you</h3>
        <p className="mx-auto mt-3 max-w-md text-[var(--color-stone)]">We’ve received your group enquiry and our team will be in touch shortly to craft the perfect experience for your occasion.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-7 md:p-9">
      <div className="grid gap-5 sm:grid-cols-2">
        <div><label htmlFor="gn" className={label}>Name *</label><input id="gn" name="name" required autoComplete="name" className={field} placeholder="Your name" /></div>
        <div><label htmlFor="gp" className={label}>Phone *</label><input id="gp" name="phone" type="tel" required autoComplete="tel" className={field} placeholder="Best number" /></div>
        <div className="sm:col-span-2"><label htmlFor="ge" className={label}>Email *</label><input id="ge" name="email" type="email" required autoComplete="email" className={field} placeholder="you@email.com" /></div>
        <div><label htmlFor="go" className={label}>Occasion</label>
          <select id="go" name="occasion" className={field} defaultValue="">
            <option value="">Select…</option>
            <option>Birthday</option><option>Hen party</option><option>Bridal party</option>
            <option>Corporate / team</option><option>Celebration</option><option>Other</option>
          </select>
        </div>
        <div><label htmlFor="gs" className={label}>Group size</label><input id="gs" name="size" inputMode="numeric" className={field} placeholder="e.g. 6" /></div>
        <div><label htmlFor="gd" className={label}>Preferred date</label><input id="gd" name="date" type="date" className={field} /></div>
        <div><label htmlFor="gt" className={label}>Treatments of interest</label><input id="gt" name="treatments" className={field} placeholder="e.g. facials, HydraGlow" /></div>
        <div className="sm:col-span-2"><label htmlFor="gm" className={label}>Tell us about your event *</label><textarea id="gm" name="message" rows={4} required minLength={2} className={field} placeholder="What you have in mind — timings, any extras, refreshments…" /></div>
      </div>
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="absolute -left-[9999px] h-0 w-0" aria-hidden />
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button size="lg" type="submit" disabled={busy}>{busy ? 'Sending…' : <>Send group enquiry <ArrowIcon /></>}</Button>
        <p className="text-sm text-[var(--color-stone)]">Or call <a href={site.phoneHref} className="link-underline font-medium text-[var(--color-ink)]">{site.phone}</a></p>
      </div>
      {status === 'error' && <p className="mt-4 rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-4 py-3 text-sm text-[var(--color-ink)]">Something went wrong — please call us or email {site.email}.</p>}
    </form>
  );
}
