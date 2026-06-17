'use client';

import { useState, type FormEvent } from 'react';
import { site } from '@/lib/site';
import { Button, ArrowIcon } from '@/components/ui/Button';
import { trackLead } from '@/lib/analytics-events';

/** Franchise enquiry — records the lead via /api/consult (same pipeline as the
 *  contact form) so it lands in the CRM and notifies the clinic. */
export function FranchiseEnquiryForm() {
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get('name') || '').trim();
    const email = String(f.get('email') || '');
    const phone = String(f.get('phone') || '');
    const location = String(f.get('location') || '');
    const model = String(f.get('model') || '');
    const note = String(f.get('message') || '');
    const company = String(f.get('company') || ''); // honeypot

    setBusy(true);
    try {
      const [firstName, ...rest] = (name || 'Franchise enquiry').split(/\s+/);
      const message = [
        'Franchise enquiry',
        location ? `Preferred location: ${location}` : '',
        model ? `Interested model: ${model}` : '',
        '',
        note,
      ].filter(Boolean).join('\n');
      const res = await fetch('/api/consult', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: firstName || 'Franchise', lastName: rest.join(' ') || undefined, email, phone: phone || undefined, category: 'general', message, consent: true, company }),
      });
      const j = await res.json().catch(() => ({ ok: false }));
      if (j.ok) trackLead();
      setStatus(j.ok ? 'sent' : 'error');
    } catch {
      setStatus('error');
    } finally {
      setBusy(false);
    }
  }

  const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 py-3 text-[var(--color-ink)] outline-none transition-colors placeholder:text-[var(--color-stone-soft)] focus:border-[var(--color-gold)]';
  const label = 'mb-1.5 block text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]';

  if (status === 'sent') {
    return (
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 text-center">
        <h3 className="font-[family-name:var(--font-display)] text-2xl">Thank you for your interest</h3>
        <p className="mx-auto mt-3 max-w-md text-[var(--color-stone)]">We’ve received your franchise enquiry and a member of our team will be in touch shortly to discuss the opportunity.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-7 md:p-9">
      <h3 className="font-[family-name:var(--font-display)] text-2xl">Enquire about a franchise</h3>
      <p className="mt-1 text-sm text-[var(--color-stone)]">Tell us a little about you and we’ll be in touch about the opportunity.</p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div><label htmlFor="fn" className={label}>Name *</label><input id="fn" name="name" required autoComplete="name" className={field} placeholder="Your name" /></div>
        <div><label htmlFor="fp" className={label}>Phone *</label><input id="fp" name="phone" type="tel" required autoComplete="tel" className={field} placeholder="Best number" /></div>
        <div className="sm:col-span-2"><label htmlFor="fe" className={label}>Email *</label><input id="fe" name="email" type="email" required autoComplete="email" className={field} placeholder="you@email.com" /></div>
        <div><label htmlFor="fl" className={label}>Preferred location</label><input id="fl" name="location" className={field} placeholder="City / area" /></div>
        <div><label htmlFor="fm" className={label}>Model of interest</label>
          <select id="fm" name="model" className={field} defaultValue="">
            <option value="">Not sure yet</option>
            <option value="Full Franchise">Full Franchise</option>
            <option value="50/50 Franchise">50/50 Franchise</option>
          </select>
        </div>
        <div className="sm:col-span-2"><label htmlFor="fmsg" className={label}>Your message *</label><textarea id="fmsg" name="message" rows={4} required minLength={2} className={field} placeholder="Your background, timeline and any questions…" /></div>
      </div>
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="absolute -left-[9999px] h-0 w-0" aria-hidden />
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button size="lg" type="submit" disabled={busy}>{busy ? 'Sending…' : <>Send enquiry <ArrowIcon /></>}</Button>
        <p className="text-sm text-[var(--color-stone)]">Or call <a href={site.phoneHref} className="link-underline font-medium text-[var(--color-ink)]">{site.phone}</a></p>
      </div>
      {status === 'error' && <p className="mt-4 rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-4 py-3 text-sm text-[var(--color-ink)]">Something went wrong — please call us or email {site.email}.</p>}
      <p className="mt-4 text-xs leading-relaxed text-[var(--color-stone-soft)]">By submitting, you agree to be contacted about your enquiry. We never share your details.</p>
    </form>
  );
}
