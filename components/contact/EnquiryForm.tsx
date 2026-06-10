'use client';

import { useState, useId, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { treatments } from '@/lib/treatments';
import { site } from '@/lib/site';
import { Button, ArrowIcon } from '@/components/ui/Button';

/** Premium enquiry form. With no backend in a static export, it composes a
 *  pre-filled email to the clinic via mailto: — reliable, zero-infra, and easy
 *  to swap for an API/Formspree endpoint later (see handleSubmit). */
export function EnquiryForm() {
  const [status, setStatus] = useState<'idle' | 'sent' | 'mailto'>('idle');
  const [busy, setBusy] = useState(false);
  // BLD-125: stable IDs for aria-describedby on the success/fallback message.
  const statusId = useId();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get('name') || '').trim();
    const email = String(f.get('email') || '');
    const phone = String(f.get('phone') || '');
    const interest = String(f.get('interest') || '');
    const message = String(f.get('message') || '');

    const mailtoFallback = () => {
      const subject = `Enquiry from ${name || 'website'} — ${interest || 'General'}`;
      const body = [`Name: ${name}`, `Email: ${email}`, `Phone: ${phone}`, `Interest: ${interest}`, '', message].join('\n');
      window.location.href = `${site.emailHref}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      setStatus('mailto');
    };

    // Record the enquiry server-side (creates the lead + notifies the clinic),
    // falling back to a mailto: handoff only if that isn't available.
    setBusy(true);
    try {
      const [firstName, ...rest] = (name || 'Website enquiry').split(/\s+/);
      const res = await fetch('/api/consult', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName || 'Website', lastName: rest.join(' ') || undefined, email, phone: phone || undefined,
          category: 'general', message: interest ? `Interested in: ${interest}\n\n${message}` : message, consent: true,
        }),
      });
      const j = await res.json().catch(() => ({ ok: false }));
      if (j.ok) setStatus('sent'); else mailtoFallback();
    } catch {
      mailtoFallback();
    } finally {
      setBusy(false);
    }
  }

  const field =
    'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 py-3 text-[var(--color-ink)] outline-none transition-colors placeholder:text-[var(--color-stone-soft)] focus:border-[var(--color-gold)]';
  const label = 'mb-1.5 block text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]';

  return (
    <form onSubmit={handleSubmit} className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-7 md:p-9" aria-describedby={status !== 'idle' ? statusId : undefined}>
      {/* BLD-122: md:grid-cols-2 (was sm:) so name/phone labels don't wrap on <=390px */}
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="name" className={label}>Name</label>
          <input id="name" name="name" required autoComplete="name" className={field} placeholder="Your name" />
        </div>
        <div>
          <label htmlFor="phone" className={label}>Phone</label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" className={field} placeholder="Optional" />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="email" className={label}>Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className={field} placeholder="you@email.com" />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="interest" className={label}>I'm interested in</label>
          <select id="interest" name="interest" className={field} defaultValue="">
            <option value="" disabled>Select a treatment…</option>
            <option value="General enquiry">General enquiry</option>
            <option value="Free consultation">Free consultation</option>
            <optgroup label="Aesthetics">
              {treatments.filter((t) => t.category === 'aesthetics').map((t) => (
                <option key={t.slug} value={t.title}>{t.title}</option>
              ))}
            </optgroup>
            <optgroup label="Dentistry">
              {treatments.filter((t) => t.category === 'dentistry').map((t) => (
                <option key={t.slug} value={t.title}>{t.title}</option>
              ))}
            </optgroup>
          </select>
        </div>
        <div className="md:col-span-2">
          <label htmlFor="message" className={label}>Message *</label>
          <textarea id="message" name="message" rows={4} required minLength={2} className={field} placeholder="Tell us a little about what you're looking for…" />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button size="lg" type="submit" disabled={busy}>{busy ? 'Sending…' : <>Send enquiry <ArrowIcon /></>}</Button>
        <p className="text-sm text-[var(--color-stone)]">
          Or call <a href={site.phoneHref} className="link-underline font-medium text-[var(--color-ink)]">{site.phone}</a>
        </p>
      </div>

      {/* BLD-125: role=status announces the confirmation to screen readers without
          interrupting the current interaction (live region, not alert). */}
      <AnimatePresence>
        {status !== 'idle' && (
          <motion.p
            id={statusId}
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-[var(--radius-sm)] bg-[var(--color-jade)]/12 px-4 py-3 text-sm text-[var(--color-jade)]"
          >
            {status === 'sent'
              ? <>Thank you — we&apos;ve received your enquiry and will be in touch shortly.</>
              : <>Your email app should now open with your enquiry ready to send. If not, email us directly at <a href={site.emailHref} className="link-underline font-medium">{site.email}</a>.</>}
          </motion.p>
        )}
      </AnimatePresence>

      <p className="mt-4 text-xs leading-relaxed text-[var(--color-stone-soft)]">
        By submitting, you agree to be contacted about your enquiry. We never share your details.
      </p>
    </form>
  );
}
