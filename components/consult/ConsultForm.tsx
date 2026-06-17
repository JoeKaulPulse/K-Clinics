'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { treatments } from '@/lib/treatments';
import { site } from '@/lib/site';
import { Button, ArrowIcon } from '@/components/ui/Button';
import { trackLead } from '@/lib/analytics-events';

type Data = {
  category: 'aesthetics' | 'dentistry' | 'both' | 'general';
  treatments: string[];
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  preferredContact: 'email' | 'phone' | 'whatsapp' | '';
  preferredTime: string;
  concerns: string;
  message: string;
  marketingOptIn: boolean;
  consent: boolean;
  company: string; // honeypot
};

const empty: Data = {
  category: 'general', treatments: [], firstName: '', lastName: '', email: '', phone: '', dob: '',
  preferredContact: '', preferredTime: '', concerns: '', message: '', marketingOptIn: false, consent: false, company: '',
};

const aesthetic = treatments.filter((t) => t.category === 'aesthetics');
const dental = treatments.filter((t) => t.category === 'dentistry');

const field =
  'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 py-3 text-[var(--color-ink)] outline-none transition-colors placeholder:text-[var(--color-stone-soft)] focus:border-[var(--color-gold)]';
const label = 'mb-1.5 block text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]';

export function ConsultForm() {
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Data>(empty);
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  const set = <K extends keyof Data>(k: K, v: Data[K]) => setD((p) => ({ ...p, [k]: v }));
  const toggleTreatment = (name: string) =>
    setD((p) => ({ ...p, treatments: p.treatments.includes(name) ? p.treatments.filter((t) => t !== name) : [...p.treatments, name] }));

  const steps = ['Interest', 'Treatments', 'Your details', 'Anything else'];

  const canNext =
    (step === 0 && d.category) ||
    step === 1 ||
    (step === 2 && d.firstName && /\S+@\S+\.\S+/.test(d.email)) ||
    step === 3;

  async function submit() {
    setStatus('sending');
    setError('');
    // Shared id so the browser Lead event de-duplicates against the server-side
    // CAPI Lead (sent from /api/consult).
    const eventId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
    try {
      const res = await fetch('/api/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...d, eventId }),
      });
      const json = await res.json();
      if (json.ok) {
        trackLead({ eventId });
        setStatus('done');
        return;
      }
      if (json.fallback === 'mailto') {
        // Static demo (no backend): hand off to email client.
        const subject = `Consultation enquiry — ${d.firstName} ${d.lastName}`.trim();
        const body = [
          `Name: ${d.firstName} ${d.lastName}`, `Email: ${d.email}`, `Phone: ${d.phone}`,
          `Interest: ${d.category}`, `Treatments: ${d.treatments.join(', ')}`,
          `Preferred contact: ${d.preferredContact}`, `Preferred time: ${d.preferredTime}`,
          '', d.concerns, d.message,
        ].join('\n');
        window.location.href = `${site.emailHref}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        setStatus('done');
        return;
      }
      setError(json.error || 'Something went wrong.');
      setStatus('error');
    } catch {
      setError('Network error — please try again or call us.');
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-10 text-center md:p-16"
      >
        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-[var(--color-ink)] text-[var(--color-gold-soft)]">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <h2 className="text-title">Thank you, {d.firstName || 'and welcome'}.</h2>
        <p className="mx-auto mt-4 max-w-md text-[var(--color-stone)]">
          Your consultation request is with us. Our team will be in touch very shortly to arrange your complimentary visit.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-6 md:p-10">
      {/* Progress */}
      <div className="mb-8 flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex flex-1 flex-col gap-2">
            <div className="h-1 overflow-hidden rounded-full bg-[var(--color-sand)]">
              <motion.div
                className="h-full bg-[var(--color-gold)]"
                initial={false}
                animate={{ width: i < step ? '100%' : i === step ? '50%' : '0%' }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <span className={`hidden text-[0.65rem] uppercase tracking-[0.14em] sm:block ${i === step ? 'text-[var(--color-gold)]' : 'text-[var(--color-stone)]'}`}>{s}</span>
          </div>
        ))}
      </div>

      {/* Honeypot */}
      <input type="text" tabIndex={-1} autoComplete="off" value={d.company} onChange={(e) => set('company', e.target.value)} className="absolute -left-[9999px] h-0 w-0" aria-hidden />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          {step === 0 && (
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-2xl">What brings you to KClinics?</h3>
              <p className="mt-2 text-sm text-[var(--color-stone)]">Choose the area you’re most interested in.</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {([['aesthetics', 'Aesthetics', 'Laser, skin & body'], ['dentistry', 'Dentistry', 'Smile & dental'], ['both', 'Both', 'A complete plan'], ['general', 'Just exploring', 'Help me decide']] as const).map(([val, title, sub]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => set('category', val)}
                    className={`rounded-[var(--radius-md)] border p-5 text-left transition-all ${d.category === val ? 'border-[var(--color-gold)] bg-[var(--color-porcelain)] shadow-[var(--shadow-soft)]' : 'border-[var(--color-line)] hover:border-[var(--color-stone-soft)]'}`}
                  >
                    <span className="block font-[family-name:var(--font-display)] text-lg">{title}</span>
                    <span className="mt-0.5 block text-sm text-[var(--color-stone)]">{sub}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-2xl">Any treatments in mind?</h3>
              <p className="mt-2 text-sm text-[var(--color-stone)]">Optional — select any that interest you.</p>
              {(d.category !== 'dentistry') && (
                <Group title="Aesthetics" items={aesthetic} selected={d.treatments} onToggle={toggleTreatment} />
              )}
              {(d.category !== 'aesthetics') && (
                <Group title="Dentistry" items={dental} selected={d.treatments} onToggle={toggleTreatment} />
              )}
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-5 sm:grid-cols-2">
              <div><label className={label} htmlFor="fn">First name *</label><input id="fn" autoComplete="given-name" className={field} value={d.firstName} onChange={(e) => set('firstName', e.target.value)} /></div>
              <div><label className={label} htmlFor="ln">Last name</label><input id="ln" autoComplete="family-name" className={field} value={d.lastName} onChange={(e) => set('lastName', e.target.value)} /></div>
              <div className="sm:col-span-2"><label className={label} htmlFor="em">Email *</label><input id="em" type="email" autoComplete="email" className={field} value={d.email} onChange={(e) => set('email', e.target.value)} /></div>
              <div><label className={label} htmlFor="ph">Phone</label><input id="ph" type="tel" autoComplete="tel" className={field} value={d.phone} onChange={(e) => set('phone', e.target.value)} /></div>
              <div><label className={label} htmlFor="db">Date of birth</label><input id="db" type="date" autoComplete="bday" className={field} value={d.dob} onChange={(e) => set('dob', e.target.value)} /></div>
              <div>
                <label className={label} htmlFor="pc">Preferred contact</label>
                <select id="pc" className={field} value={d.preferredContact} onChange={(e) => set('preferredContact', e.target.value as Data['preferredContact'])}>
                  <option value="">No preference</option><option value="email">Email</option><option value="phone">Phone</option><option value="whatsapp">WhatsApp</option>
                </select>
              </div>
              <div><label className={label} htmlFor="pt">Best time to reach you</label><input id="pt" className={field} placeholder="e.g. weekday mornings" value={d.preferredTime} onChange={(e) => set('preferredTime', e.target.value)} /></div>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-5">
              <div><label className={label} htmlFor="co">Your concerns or goals</label><textarea id="co" rows={3} className={field} placeholder="Tell us what you’d love to achieve…" value={d.concerns} onChange={(e) => set('concerns', e.target.value)} /></div>
              <div><label className={label} htmlFor="ms">Anything else?</label><textarea id="ms" rows={2} className={field} value={d.message} onChange={(e) => set('message', e.target.value)} /></div>
              <label className="flex items-start gap-3 text-sm text-[var(--color-stone)]">
                <input type="checkbox" checked={d.marketingOptIn} onChange={(e) => set('marketingOptIn', e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--color-gold)]" />
                Keep me updated with offers, events and skincare tips.
              </label>
              <label className="flex items-start gap-3 text-sm text-[var(--color-stone)]">
                <input type="checkbox" checked={d.consent} onChange={(e) => set('consent', e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--color-gold)]" />
                I consent to KClinics contacting me about my enquiry. *
              </label>
              {error && <p className="rounded-[var(--radius-sm)] bg-[var(--color-blush)]/20 px-4 py-3 text-sm text-[var(--color-ink)]">{error}</p>}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Nav */}
      <div className="mt-8 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className={`text-sm font-medium text-[var(--color-stone)] transition-opacity ${step === 0 ? 'pointer-events-none opacity-0' : 'hover:text-[var(--color-ink)]'}`}
        >
          ← Back
        </button>
        {step < 3 ? (
          <Button onClick={() => canNext && setStep((s) => s + 1)} variant={canNext ? 'gold' : 'outline'}>
            Continue <ArrowIcon />
          </Button>
        ) : (
          <Button onClick={() => d.consent && status !== 'sending' && submit()} variant={d.consent ? 'gold' : 'outline'}>
            {status === 'sending' ? 'Sending…' : 'Request consultation'} <ArrowIcon />
          </Button>
        )}
      </div>
    </div>
  );
}

function Group({ title, items, selected, onToggle }: { title: string; items: typeof treatments; selected: string[]; onToggle: (n: string) => void }) {
  return (
    <div className="mt-6">
      <p className="eyebrow mb-3">{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((t) => {
          const on = selected.includes(t.title);
          return (
            <button
              key={t.slug}
              type="button"
              onClick={() => onToggle(t.title)}
              className={`rounded-full border px-4 py-2 text-sm transition-all ${on ? 'border-[var(--color-gold)] bg-[var(--color-gold)] text-white' : 'border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-stone-soft)]'}`}
            >
              {t.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}
