'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { getStripe, bookingEnabled } from '@/lib/stripe-client';
import { Button, ArrowIcon } from '@/components/ui/Button';
import { site } from '@/lib/site';

type Treatment = { slug: string; title: string; group: string; category: string; pricePence: number | null; durationMin: number; tagline: string };

const field =
  'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 py-3 text-[var(--color-ink)] outline-none transition-colors placeholder:text-[var(--color-stone-soft)] focus:border-[var(--color-gold)]';
const label = 'mb-1.5 block text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]';

const money = (p: number | null) => (p == null ? 'On consultation' : `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}`);

// Public wrapper — reads an optional ?treatment=slug deep-link via Suspense so
// the host page stays statically renderable.
export function BookingFlow({ treatments }: { treatments: Treatment[] }) {
  return (
    <Suspense fallback={<BookingFlowInner treatments={treatments} />}>
      <BookingFlowWithParam treatments={treatments} />
    </Suspense>
  );
}

function BookingFlowWithParam({ treatments }: { treatments: Treatment[] }) {
  const params = useSearchParams();
  const slug = params.get('treatment') || undefined;
  const initialSlug = slug && treatments.some((t) => t.slug === slug) ? slug : undefined;
  return <BookingFlowInner treatments={treatments} initialSlug={initialSlug} />;
}

function BookingFlowInner({ treatments, initialSlug }: { treatments: Treatment[]; initialSlug?: string }) {
  const [step, setStep] = useState(initialSlug ? 1 : 0);
  const [slug, setSlug] = useState(initialSlug || '');
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<string[]>([]);
  const [slot, setSlot] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [details, setDetails] = useState({ firstName: '', lastName: '', email: '', phone: '', notes: '', marketingOptIn: false, consent: false, company: '' });
  const [clientSecret, setClientSecret] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [done, setDone] = useState(false);

  const treatment = treatments.find((t) => t.slug === slug);
  const steps = ['Treatment', 'Date & time', 'Your details', 'Confirm'];

  // Load slots when date/treatment chosen.
  useEffect(() => {
    if (step !== 1 || !slug || !date) return;
    setLoadingSlots(true); setSlot(''); setSlots([]);
    fetch('/api/booking/availability', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, date }) })
      .then((r) => r.json()).then((j) => setSlots(j.slots || [])).catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [step, slug, date]);

  const minDate = useMemo(() => new Date(Date.now() + 864e5).toISOString().slice(0, 10), []);

  async function createBooking() {
    setCreating(true); setError('');
    try {
      const res = await fetch('/api/booking/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, startISO: slot, ...details }),
      });
      const j = await res.json();
      if (j.ok && j.clientSecret) {
        setClientSecret(j.clientSecret); setBookingId(j.bookingId); setStep(3);
      } else {
        setError(j.error || 'Could not start booking.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  if (!bookingEnabled) {
    return (
      <div className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 text-center md:p-12">
        <h2 className="text-title">Booking opens soon</h2>
        <p className="mx-auto mt-3 max-w-md text-[var(--color-stone)]">
          Online booking isn’t enabled in this preview. Call <a href={site.phoneHref} className="link-underline font-medium text-[var(--color-ink)]">{site.phone}</a> or request a consultation.
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-10 text-center md:p-16">
        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-[var(--color-ink)] text-[var(--color-gold-soft)]">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <h2 className="text-title">You’re booked in.</h2>
        <p className="mx-auto mt-4 max-w-md text-[var(--color-stone)]">
          A confirmation is on its way to {details.email}. Your card is securely saved — no payment is taken until your treatment is delivered. You can cancel free up to 24 hours before.
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
              <motion.div className="h-full bg-[var(--color-gold)]" initial={false} animate={{ width: i < step ? '100%' : i === step ? '50%' : '0%' }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} />
            </div>
            <span className={`hidden text-[0.65rem] uppercase tracking-[0.14em] sm:block ${i === step ? 'text-[var(--color-gold)]' : 'text-[var(--color-stone)]'}`}>{s}</span>
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
          {/* Step 0 — treatment */}
          {step === 0 && (
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-2xl">Choose your treatment</h3>
              <div className="mt-6 grid max-h-[26rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {treatments.map((t) => (
                  <button key={t.slug} type="button" onClick={() => { setSlug(t.slug); setStep(1); }}
                    className={`flex items-center justify-between gap-3 rounded-[var(--radius-md)] border p-4 text-left transition-all ${slug === t.slug ? 'border-[var(--color-gold)] bg-[var(--color-porcelain)]' : 'border-[var(--color-line)] hover:border-[var(--color-stone-soft)]'}`}>
                    <span>
                      <span className="block font-[family-name:var(--font-display)] text-base leading-tight">{t.title}</span>
                      <span className="text-xs text-[var(--color-stone)]">{t.durationMin} min</span>
                    </span>
                    <span className="shrink-0 text-sm font-medium text-[var(--color-gold)]">{money(t.pricePence)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1 — date & slot */}
          {step === 1 && treatment && (
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-2xl">{treatment.title}</h3>
              <p className="mt-1 text-sm text-[var(--color-stone)]">{treatment.durationMin} min · {money(treatment.pricePence)}</p>
              <div className="mt-6">
                <label className={label} htmlFor="bdate">Select a date</label>
                <input id="bdate" type="date" min={minDate} value={date} onChange={(e) => setDate(e.target.value)} className={field} />
              </div>
              {date && (
                <div className="mt-6">
                  <p className={label}>Available times</p>
                  {loadingSlots ? (
                    <p className="text-sm text-[var(--color-stone)]">Finding available times…</p>
                  ) : slots.length === 0 ? (
                    <p className="text-sm text-[var(--color-stone)]">No availability that day — please try another date.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {slots.map((s) => {
                        const t = new Date(s).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                        return (
                          <button key={s} type="button" onClick={() => setSlot(s)}
                            className={`rounded-full border px-4 py-2 text-sm transition-all ${slot === s ? 'border-[var(--color-gold)] bg-[var(--color-gold)] text-white' : 'border-[var(--color-line)] hover:border-[var(--color-stone-soft)]'}`}>
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 2 — details */}
          {step === 2 && (
            <div className="grid gap-5 sm:grid-cols-2">
              <div><label className={label} htmlFor="bfn">First name *</label><input id="bfn" className={field} value={details.firstName} onChange={(e) => setDetails({ ...details, firstName: e.target.value })} /></div>
              <div><label className={label} htmlFor="bln">Last name</label><input id="bln" className={field} value={details.lastName} onChange={(e) => setDetails({ ...details, lastName: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className={label} htmlFor="bem">Email *</label><input id="bem" type="email" className={field} value={details.email} onChange={(e) => setDetails({ ...details, email: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className={label} htmlFor="bph">Phone</label><input id="bph" type="tel" className={field} value={details.phone} onChange={(e) => setDetails({ ...details, phone: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className={label} htmlFor="bno">Notes (optional)</label><textarea id="bno" rows={2} className={field} value={details.notes} onChange={(e) => setDetails({ ...details, notes: e.target.value })} /></div>
              <input type="text" tabIndex={-1} autoComplete="off" value={details.company} onChange={(e) => setDetails({ ...details, company: e.target.value })} className="absolute -left-[9999px] h-0 w-0" aria-hidden />
              <label className="flex items-start gap-3 text-sm text-[var(--color-stone)] sm:col-span-2">
                <input type="checkbox" checked={details.marketingOptIn} onChange={(e) => setDetails({ ...details, marketingOptIn: e.target.checked })} className="mt-1 h-4 w-4 accent-[var(--color-gold)]" />
                Keep me updated with offers and skincare tips.
              </label>
              <label className="flex items-start gap-3 text-sm text-[var(--color-stone)] sm:col-span-2">
                <input type="checkbox" checked={details.consent} onChange={(e) => setDetails({ ...details, consent: e.target.checked })} className="mt-1 h-4 w-4 accent-[var(--color-gold)]" />
                I agree to the booking terms: my card is saved but not charged now; I’ll be charged when the service is delivered; cancellations within 24 hours are charged in full. *
              </label>
            </div>
          )}

          {/* Step 3 — payment (save card) */}
          {step === 3 && clientSecret && (
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-2xl">Secure your booking</h3>
              <div className="mt-2 rounded-[var(--radius-sm)] bg-[var(--color-porcelain)] p-4 text-sm text-[var(--color-stone)]">
                <p><strong className="text-[var(--color-ink)]">{treatment?.title}</strong> · {slot && new Date(slot).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                <p className="mt-1">We securely save your card now — <strong>no payment is taken</strong> until your treatment is delivered.</p>
              </div>
              <div className="mt-5">
                <ElementsWrapper clientSecret={clientSecret}>
                  <CardStep bookingId={bookingId} onDone={() => setDone(true)} onError={setError} />
                </ElementsWrapper>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {error && <p className="mt-4 rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-4 py-3 text-sm text-[var(--color-ink)]">{error}</p>}

      {/* Nav (hidden on card step — handled inside) */}
      {step < 3 && (
        <div className="mt-8 flex items-center justify-between gap-4">
          <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} className={`text-sm font-medium text-[var(--color-stone)] ${step === 0 ? 'pointer-events-none opacity-0' : 'hover:text-[var(--color-ink)]'}`}>← Back</button>
          {step === 1 && <Button onClick={() => slot && setStep(2)} variant={slot ? 'gold' : 'outline'}>Continue <ArrowIcon /></Button>}
          {step === 2 && <Button onClick={() => details.firstName && /\S+@\S+\.\S+/.test(details.email) && details.consent && !creating && createBooking()} variant={details.consent ? 'gold' : 'outline'}>{creating ? 'Securing…' : 'Continue to card'} <ArrowIcon /></Button>}
          {step === 0 && <span />}
        </div>
      )}
    </div>
  );
}

function ElementsWrapper({ clientSecret, children }: { clientSecret: string; children: React.ReactNode }) {
  const stripePromise = getStripe();
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'flat', variables: { colorPrimary: '#a98a6d', fontFamily: 'system-ui, sans-serif', borderRadius: '10px', colorBackground: '#f6ece3' } } }}>
      {children}
    </Elements>
  );
}

function CardStep({ bookingId, onDone, onError }: { bookingId: string; onDone: () => void; onError: (e: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!stripe || !elements) return;
    setSubmitting(true); onError('');
    const { error } = await stripe.confirmSetup({ elements, redirect: 'if_required' });
    if (error) { onError(error.message || 'Card could not be saved.'); setSubmitting(false); return; }
    const res = await fetch('/api/booking/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId }) });
    const j = await res.json();
    if (j.ok) onDone();
    else { onError(j.error || 'Could not confirm booking.'); setSubmitting(false); }
  }

  return (
    <div>
      <PaymentElement />
      <div className="mt-6 flex justify-end">
        <Button onClick={submit} variant="gold" size="lg">{submitting ? 'Confirming…' : 'Confirm booking'} <ArrowIcon /></Button>
      </div>
    </div>
  );
}
