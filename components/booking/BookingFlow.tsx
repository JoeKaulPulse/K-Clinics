'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { getStripe } from '@/lib/stripe-client';
import { isDemo } from '@/lib/booking-mode';
import { demoSlots } from '@/lib/availability-client';
import { DemoCard } from '@/components/booking/DemoCard';
import { Button, ArrowIcon } from '@/components/ui/Button';
import { REFRESHMENTS } from '@/lib/hospitality';

type Course = { sessions: number; totalPence: number };
type Variant = { id: string; name: string; durationMin: number; pricePence: number; offerPence: number | null; offerName: string | null; courses: Course[] };
type Service = { id: string; slug: string; treatmentSlug: string; name: string; category: string; audience: string; variants: Variant[] };
type ClientInfo = { signedIn: boolean; firstName: string; email: string; gender: string | null; smsReminders: boolean; hasPhone: boolean; welcomeEligible: boolean };

const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 py-3 text-[var(--color-ink)] outline-none transition-colors placeholder:text-[var(--color-stone-soft)] focus:border-[var(--color-gold)]';
const label = 'mb-1.5 block text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]';
const money = (p: number) => (p <= 0 ? 'On consultation' : `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}`);

const UPSELL_PCT = 20;

// Gender suitability (inclusive): undisclosed / non-binary / other see everything.
function suitable(audience: string, gender: string | null): boolean {
  if (audience === 'all' || !gender) return true;
  if (gender === 'FEMALE') return audience !== 'male';
  if (gender === 'MALE') return audience !== 'female';
  return true;
}

type Stage = 'account' | 'service' | 'variant' | 'time' | 'upsell' | 'card' | 'done';

export function BookingFlow({ catalogue, client, preselect = null }: { catalogue: Service[]; client: ClientInfo; preselect?: string | null }) {
  const [authed, setAuthed] = useState(client.signedIn);
  const [firstName, setFirstName] = useState(client.firstName);
  const [gender, setGender] = useState<string | null>(client.gender);
  const [welcome, setWelcome] = useState(client.welcomeEligible);
  const [smsPref, setSmsPref] = useState(client.smsReminders);

  // Deep-link preselect (e.g. from K Vision "Book →"): jump straight to the
  // variant step for that service when the client is already signed in.
  const validPreselect = preselect && catalogue.some((s) => s.id === preselect) ? preselect : '';
  const [stage, setStage] = useState<Stage>(client.signedIn ? (validPreselect ? 'variant' : 'service') : 'account');
  const [serviceId, setServiceId] = useState(validPreselect);
  const [variantId, setVariantId] = useState('');
  const [sessions, setSessions] = useState(1);
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<string[]>([]);
  const [preferred, setPreferred] = useState<string[]>([]);
  const [slot, setSlot] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [addOns, setAddOns] = useState<Set<string>>(new Set());
  const [refreshments, setRefreshments] = useState<Set<string>>(new Set());
  const [allergyNote, setAllergyNote] = useState('');
  const [aftercareAck, setAftercareAck] = useState(false);
  const [ageDeclare, setAgeDeclare] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState<{ ok: boolean; code?: string; label?: string | null; discountPence?: number; finalPence?: number; error?: string } | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);

  const [clientSecret, setClientSecret] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const service = catalogue.find((s) => s.id === serviceId);
  const variant = service?.variants.find((v) => v.id === variantId);

  // Effective single-session price for the primary (best of live offer vs 15% welcome).
  function primaryPrice(v: Variant) {
    const offer = v.offerPence != null ? v.pricePence - v.offerPence : 0;
    const wel = welcome && v.pricePence > 0 ? Math.round(v.pricePence * 0.15) : 0;
    const disc = Math.max(offer, wel);
    return { price: Math.max(0, v.pricePence - disc), tag: disc > 0 ? (offer >= wel && v.offerName ? v.offerName : '15% welcome') : null, was: disc > 0 ? v.pricePence : null };
  }
  function addOnPrice(v: Variant) {
    const offer = v.offerPence != null ? v.pricePence - v.offerPence : 0;
    const up = Math.round(v.pricePence * (UPSELL_PCT / 100));
    const disc = Math.max(offer, up);
    return { price: Math.max(0, v.pricePence - disc), saved: disc };
  }

  // Recommended upsells: cheapest variant of each other gender-suitable service.
  const recommendations = useMemo(() => {
    if (!service) return [] as { service: Service; variant: Variant }[];
    return catalogue
      .filter((s) => s.id !== service.id && suitable(s.audience, gender) && s.variants.length > 0)
      .map((s) => ({ service: s, variant: [...s.variants].sort((a, b) => a.pricePence - b.pricePence)[0] }))
      .filter((r) => r.variant.pricePence > 0)
      .slice(0, 4);
  }, [catalogue, service, gender]);

  const totalDuration = useMemo(() => {
    if (!variant) return 0;
    let d = variant.durationMin;
    addOns.forEach((id) => { const av = catalogue.flatMap((s) => s.variants).find((v) => v.id === id); if (av) d += av.durationMin; });
    return d;
  }, [variant, addOns, catalogue]);

  // Live availability from the admin engine (works without Stripe).
  useEffect(() => {
    if (stage !== 'time' || !service || !variant || !date) return;
    setSlot(''); setSlots([]);
    if (isDemo) { setSlots(demoSlots(date, totalDuration, [])); setPreferred([]); return; }
    setLoadingSlots(true);
    fetch('/api/booking/availability', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: service.treatmentSlug, date, durationMin: totalDuration }) })
      .then((r) => r.json()).then((j) => { setSlots(j.slots || []); setPreferred(j.preferred || []); }).catch(() => { setSlots([]); setPreferred([]); })
      .finally(() => setLoadingSlots(false));
  }, [stage, service, variant, date, totalDuration]);

  const minDate = useMemo(() => new Date(Date.now() + 864e5).toISOString().slice(0, 10), []);

  const orderTotal = useMemo(() => {
    if (!variant) return 0;
    let t = primaryPrice(sessions > 1 ? courseAsVariant(variant, sessions) : variant).price;
    addOns.forEach((id) => { const av = catalogue.flatMap((s) => s.variants).find((v) => v.id === id); if (av) t += addOnPrice(av).price; });
    return t;
  }, [variant, sessions, addOns, catalogue, welcome]);

  async function submitBooking() {
    setSubmitting(true); setError('');
    if (isDemo) { setSubmitting(false); setStage('card'); return; }
    try {
      const res = await fetch('/api/booking/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId, sessions, startISO: slot, addOnVariantIds: [...addOns], smsReminders: smsPref, refreshments: [...refreshments], allergyNote, aftercareAck, ageDeclare, promoCode: promo?.ok ? promo.code : undefined }),
      });
      const j = await res.json();
      if (!j.ok) { setError(j.error || 'Could not book.'); setSubmitting(false); return; }
      if (j.needCard) { setClientSecret(j.clientSecret); setBookingId(j.bookingId); setStage('card'); }
      else { setStage('done'); }
    } catch { setError('Network error. Please try again.'); }
    finally { setSubmitting(false); }
  }

  async function applyPromo() {
    if (!promoInput.trim() || !service) return;
    setPromoBusy(true);
    try {
      const res = await fetch('/api/promo/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: promoInput.trim(), slug: service.treatmentSlug }) });
      setPromo(await res.json().catch(() => ({ ok: false, error: 'Could not check that code.' })));
    } catch { setPromo({ ok: false, error: 'Network error.' }); }
    finally { setPromoBusy(false); }
  }

  const steps: { key: Stage; label: string }[] = [
    ...(authed ? [] : [{ key: 'account' as Stage, label: 'Account' }]),
    { key: 'service', label: 'Treatment' }, { key: 'variant', label: 'Option' },
    { key: 'time', label: 'Time' }, { key: 'upsell', label: 'Enhance' }, { key: 'card', label: 'Confirm' },
  ];
  const stepIndex = Math.max(0, steps.findIndex((s) => s.key === stage));

  if (stage === 'done') return <Done firstName={firstName} treatment={service?.name} slot={slot} />;

  return (
    <div className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-6 md:p-10">
      <div className="mb-8 flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.key} className="flex flex-1 flex-col gap-2">
            <div className="h-1 overflow-hidden rounded-full bg-[var(--color-sand)]">
              <motion.div className="h-full bg-[var(--color-gold)]" initial={false} animate={{ width: i < stepIndex ? '100%' : i === stepIndex ? '50%' : '0%' }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} />
            </div>
            <span className={`hidden text-[0.65rem] uppercase tracking-[0.14em] sm:block ${i === stepIndex ? 'text-[var(--color-gold)]' : 'text-[var(--color-stone)]'}`}>{s.label}</span>
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={stage} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
          {stage === 'account' && (
            <AccountStep
              onAuthed={(info) => { setAuthed(true); setFirstName(info.firstName); setGender(info.gender); setWelcome(info.welcome); setSmsPref(info.sms); setStage('service'); }}
              setError={setError}
            />
          )}

          {stage === 'service' && (
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-2xl">Choose your treatment</h3>
              {welcome && <p className="mt-2 text-sm text-[var(--color-gold)]">✦ Your 15% welcome offer will be applied automatically.</p>}
              <div className="mt-6 grid max-h-[26rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {catalogue.map((s) => (
                  <button key={s.id} type="button" onClick={() => { setServiceId(s.id); setVariantId(''); setSessions(1); setAddOns(new Set()); setStage('variant'); }}
                    className={`flex items-center justify-between gap-3 rounded-[var(--radius-md)] border p-4 text-left transition-all ${serviceId === s.id ? 'border-[var(--color-gold)] bg-[var(--color-porcelain)]' : 'border-[var(--color-line)] hover:border-[var(--color-stone-soft)]'}`}>
                    <span>
                      <span className="block font-[family-name:var(--font-display)] text-base leading-tight">{s.name}</span>
                      <span className="text-xs text-[var(--color-stone)]">{s.variants.length} option{s.variants.length > 1 ? 's' : ''}</span>
                    </span>
                    <span className="shrink-0 text-sm font-medium text-[var(--color-gold)]">{(() => { const ps = s.variants.map((v) => v.offerPence ?? v.pricePence).filter((p) => p > 0); return ps.length ? `from ${money(Math.min(...ps))}` : 'On consultation'; })()}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {stage === 'variant' && service && (
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-2xl">{service.name}</h3>
              <p className="mt-1 text-sm text-[var(--color-stone)]">Choose your option.</p>
              {/laser|tattoo|ipl/i.test(service.treatmentSlug) && (
                <p className="mt-3 rounded-[var(--radius-sm)] bg-[var(--color-gold)]/10 px-3 py-2 text-xs text-[var(--color-ink)]">
                  📷 For your safety, a <strong>before photo</strong> of the treatment area is taken before laser treatment and stored <strong>securely in the clinic system only</strong> — never on a personal device, and never of intimate areas. You may opt out by signing a short form at your appointment.
                </p>
              )}
              <div className="mt-6 grid max-h-[24rem] gap-2 overflow-y-auto pr-1">
                {service.variants.map((v) => {
                  const pp = primaryPrice(v);
                  return (
                    <button key={v.id} type="button" onClick={() => { setVariantId(v.id); setSessions(1); }}
                      className={`flex items-center justify-between gap-3 rounded-[var(--radius-md)] border p-4 text-left transition-all ${variantId === v.id ? 'border-[var(--color-gold)] bg-[var(--color-porcelain)]' : 'border-[var(--color-line)] hover:border-[var(--color-stone-soft)]'}`}>
                      <span>
                        <span className="block text-sm font-medium">{v.name}</span>
                        <span className="text-xs text-[var(--color-stone)]">{v.durationMin} min{pp.tag ? ` · ${pp.tag}` : ''}</span>
                      </span>
                      <span className="shrink-0 text-right text-sm font-medium text-[var(--color-gold)]">
                        {pp.was && <span className="mr-1 text-xs text-[var(--color-stone-soft)] line-through">{money(pp.was)}</span>}
                        {money(pp.price)}
                      </span>
                    </button>
                  );
                })}
              </div>
              {variant && variant.courses.length > 0 && (
                <div className="mt-5">
                  <p className={label}>Single session or a course?</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setSessions(1)} className={`rounded-full border px-4 py-2 text-sm ${sessions === 1 ? 'border-[var(--color-gold)] bg-[var(--color-gold)] text-white' : 'border-[var(--color-line)]'}`}>Single · {money(primaryPrice(variant).price)}</button>
                    {variant.courses.map((c) => (
                      <button key={c.sessions} onClick={() => setSessions(c.sessions)} className={`rounded-full border px-4 py-2 text-sm ${sessions === c.sessions ? 'border-[var(--color-gold)] bg-[var(--color-gold)] text-white' : 'border-[var(--color-line)]'}`}>
                        Course of {c.sessions} · {money(c.totalPence)}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-[var(--color-stone-soft)]">Booking a course reserves this appointment as your first session.</p>
                </div>
              )}
            </div>
          )}

          {stage === 'time' && service && variant && (
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-2xl">{service.name} — {variant.name}</h3>
              <p className="mt-1 text-sm text-[var(--color-stone)]">{totalDuration} min · {money(orderTotal)}{sessions > 1 ? ` · course of ${sessions}` : ''}</p>
              <div className="mt-6">
                <label className={label} htmlFor="bdate">Select a date</label>
                <input id="bdate" type="date" min={minDate} value={date} onChange={(e) => setDate(e.target.value)} className={field} />
              </div>
              {date && (
                <div className="mt-6">
                  <p className={label}>Available times</p>
                  {loadingSlots ? <p className="text-sm text-[var(--color-stone)]">Finding available times…</p>
                    : slots.length === 0 ? <p className="text-sm text-[var(--color-stone)]">No availability that day — please try another date.</p>
                    : (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {slots.map((s) => {
                            const isPref = preferred.includes(s);
                            const selected = slot === s;
                            return (
                              <button key={s} type="button" onClick={() => setSlot(s)} title={isPref ? 'Sooner-seen slot — fits neatly with the day’s other appointments' : undefined} className={`relative rounded-full border px-4 py-2 text-sm transition-all ${selected ? 'border-[var(--color-gold)] bg-[var(--color-gold)] text-white' : isPref ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/10 hover:bg-[var(--color-gold)]/20' : 'border-[var(--color-line)] hover:border-[var(--color-stone-soft)]'}`}>
                                {!selected && isPref && <span aria-hidden className="mr-1 text-[var(--color-gold)]">★</span>}
                                {new Date(s).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                              </button>
                            );
                          })}
                        </div>
                        {preferred.length > 0 && <p className="mt-2 text-xs text-[var(--color-stone-soft)]"><span className="text-[var(--color-gold)]">★</span> Recommended — these times fit neatly around the day’s other appointments, so you’re often seen more promptly.</p>}
                      </>
                    )}
                </div>
              )}
            </div>
          )}

          {stage === 'upsell' && service && variant && (
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-2xl">Enhance your visit</h3>
              <p className="mt-1 text-sm text-[var(--color-stone)]">Add a treatment to the same appointment and save {UPSELL_PCT}%{gender ? ' — picked for you' : ''}.</p>
              {recommendations.length === 0 ? (
                <p className="mt-6 text-sm text-[var(--color-stone)]">No add-ons available — continue to confirm.</p>
              ) : (
                <div className="mt-6 grid gap-2">
                  {recommendations.map(({ service: s, variant: v }) => {
                    const ap = addOnPrice(v); const on = addOns.has(v.id);
                    return (
                      <button key={v.id} type="button" onClick={() => setAddOns((prev) => { const n = new Set(prev); n.has(v.id) ? n.delete(v.id) : n.add(v.id); return n; })}
                        className={`flex items-center justify-between gap-3 rounded-[var(--radius-md)] border p-4 text-left transition-all ${on ? 'border-[var(--color-gold)] bg-[var(--color-porcelain)]' : 'border-[var(--color-line)] hover:border-[var(--color-stone-soft)]'}`}>
                        <span>
                          <span className="block text-sm font-medium">{s.name} — {v.name}</span>
                          <span className="text-xs text-[var(--color-stone)]">+{v.durationMin} min · save {money(ap.saved)}</span>
                        </span>
                        <span className="shrink-0 text-right text-sm font-medium text-[var(--color-gold)]">
                          <span className="mr-1 text-xs text-[var(--color-stone-soft)] line-through">{money(v.pricePence)}</span>{money(ap.price)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {/* Refreshments + allergies (we'll have it ready for your visit) */}
              <div className="mt-6">
                <p className={label}>Anything you’d like us to prepare?</p>
                <div className="space-y-3">
                  {REFRESHMENTS.map((g) => (
                    <div key={g.group}>
                      <p className="mb-1 text-xs text-[var(--color-stone-soft)]">{g.group}</p>
                      <div className="flex flex-wrap gap-2">
                        {g.items.map((it) => {
                          const on = refreshments.has(it.id);
                          return (
                            <button key={it.id} type="button" onClick={() => setRefreshments((p) => { const n = new Set(p); n.has(it.id) ? n.delete(it.id) : n.add(it.id); return n; })}
                              className={`rounded-full border px-3.5 py-1.5 text-sm transition-all ${on ? 'border-[var(--color-gold)] bg-[var(--color-gold)] text-white' : 'border-[var(--color-line)] hover:border-[var(--color-stone-soft)]'}`}>
                              {it.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <label className={label} htmlFor="ballergy">Any allergies or dietary notes?</label>
                  <input id="ballergy" value={allergyNote} onChange={(e) => setAllergyNote(e.target.value)} placeholder="e.g. nut allergy, no caffeine" className={field} />
                </div>
              </div>

              {/* Promo code */}
              <div className="mt-6">
                <label className={label}>Promo code (optional)</label>
                <div className="mt-1 flex gap-2">
                  <input value={promoInput} onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromo(null); }} placeholder="e.g. K10SUMMERREADY" className={`${field} uppercase`} />
                  <button type="button" onClick={applyPromo} disabled={promoBusy || !promoInput.trim()} className="shrink-0 rounded-[var(--radius-sm)] border border-[var(--color-line)] px-4 text-sm font-medium hover:border-[var(--color-gold)] disabled:opacity-50">{promoBusy ? '…' : 'Apply'}</button>
                </div>
                {promo && (promo.ok
                  ? <p className="mt-1.5 text-sm text-[var(--color-jade,#3f7a5a)]">✓ {promo.label || 'Code applied'} — you save {money(promo.discountPence || 0)} on this treatment.</p>
                  : <p className="mt-1.5 text-sm text-[var(--color-blush)]">{promo.error || 'That code isn’t valid.'}</p>)}
              </div>

              <div className="mt-4 rounded-[var(--radius-sm)] bg-[var(--color-porcelain)] p-4 text-sm">
                <div className="flex justify-between"><span className="text-[var(--color-stone)]">Total today</span><span className="font-medium">£0.00</span></div>
                <div className="flex justify-between"><span className="text-[var(--color-stone)]">Total at your visit</span><span className="font-medium text-[var(--color-ink)]">{money(orderTotal)}</span></div>
                {promo?.ok && <div className="mt-1 flex justify-between text-[var(--color-jade,#3f7a5a)]"><span>Promo {promo.code}</span><span>−{money(promo.discountPence || 0)} applied</span></div>}
                <p className="mt-2 text-xs text-[var(--color-stone-soft)]">{totalDuration} min · {[service.name, ...[...addOns].map((id) => catalogue.flatMap((s) => s.variants).find((v) => v.id === id)?.name).filter(Boolean)].join(' + ')}</p>
              </div>

              {/* Aftercare acknowledgement */}
              <label className="mt-5 flex items-start gap-3 text-sm text-[var(--color-stone)]">
                <input type="checkbox" checked={aftercareAck} onChange={(e) => setAftercareAck(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--color-gold)]" />
                I confirm I have read, understood and agree to follow the <a href="/account/aftercare" target="_blank" className="link-underline text-[var(--color-ink)]">aftercare instructions</a> for my treatment. *
              </label>
              {/* Age declaration (cosmetic treatments are 18+) */}
              <label className="mt-3 flex items-start gap-3 text-sm text-[var(--color-stone)]">
                <input type="checkbox" checked={ageDeclare} onChange={(e) => setAgeDeclare(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--color-gold)]" />
                I confirm I am 18 years of age or over. *
              </label>
            </div>
          )}

          {stage === 'card' && (isDemo || clientSecret) && (
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-2xl">Secure your booking</h3>
              <div className="mt-2 rounded-[var(--radius-sm)] bg-[var(--color-porcelain)] p-4 text-sm text-[var(--color-stone)]">
                <p><strong className="text-[var(--color-ink)]">{service?.name}</strong> · {slot && new Date(slot).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                <p className="mt-1">We securely save your card now — <strong>no payment is taken</strong> until your treatment is delivered. Free cancellation up to 24 hours before; within 24 hours the full fee applies.</p>
              </div>
              <div className="mt-5">
                {isDemo ? <DemoCard onDone={() => setStage('done')} onError={setError} />
                  : <ElementsWrapper clientSecret={clientSecret}><CardStep bookingId={bookingId} onDone={() => setStage('done')} onError={setError} /></ElementsWrapper>}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {error && <p className="mt-4 rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-4 py-3 text-sm text-[var(--color-ink)]">{error}</p>}

      {stage !== 'card' && stage !== 'account' && (
        <div className="mt-8 flex items-center justify-between gap-4">
          <button type="button" onClick={() => goBack()} className="text-sm font-medium text-[var(--color-stone)] hover:text-[var(--color-ink)]">← Back</button>
          {stage === 'variant' && <Button onClick={() => variant && setStage('time')} variant={variant ? 'gold' : 'outline'}>Continue <ArrowIcon /></Button>}
          {stage === 'time' && <Button onClick={() => slot && setStage('upsell')} variant={slot ? 'gold' : 'outline'}>Continue <ArrowIcon /></Button>}
          {stage === 'upsell' && <Button onClick={() => { if (!aftercareAck) { setError('Please confirm you’ve read and agree to the aftercare instructions.'); return; } if (!ageDeclare) { setError('Please confirm you are 18 or over.'); return; } if (!submitting) submitBooking(); }} variant={aftercareAck && ageDeclare ? 'gold' : 'outline'}>{submitting ? 'Securing…' : 'Continue to confirm'} <ArrowIcon /></Button>}
          {stage === 'service' && <span />}
        </div>
      )}
    </div>
  );

  function goBack() {
    const order: Stage[] = authed ? ['service', 'variant', 'time', 'upsell'] : ['account', 'service', 'variant', 'time', 'upsell'];
    const i = order.indexOf(stage);
    if (i > 0) setStage(order[i - 1]);
  }
}

function courseAsVariant(v: Variant, sessions: number): Variant {
  const c = v.courses.find((x) => x.sessions === sessions);
  return c ? { ...v, pricePence: c.totalPence, offerPence: null, offerName: null } : v;
}

// ── Account step (signup / login) ───────────────────────────────────────────
function AccountStep({ onAuthed, setError }: { onAuthed: (i: { firstName: string; gender: string | null; welcome: boolean; sms: boolean }) => void; setError: (e: string) => void }) {
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', gender: '', marketingOptIn: true, sms: false, consent: false, company: '' });
  const [busy, setBusy] = useState(false);

  async function signup() {
    if (!f.firstName || !/\S+@\S+\.\S+/.test(f.email) || f.password.length < 8 || !f.consent) { setError('Please complete the required fields (password 8+ characters) and accept the terms.'); return; }
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/account/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ firstName: f.firstName, lastName: f.lastName, email: f.email, phone: f.phone, password: f.password, gender: f.gender || undefined, marketingOptIn: f.marketingOptIn, locale: 'en', company: f.company }) });
      const j = await res.json();
      if (!j.ok) { setError(j.error || 'Could not create your account.'); setBusy(false); return; }
      if (f.sms && f.phone) { fetch('/api/account/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ smsReminders: true }) }).catch(() => {}); }
      onAuthed({ firstName: f.firstName, gender: f.gender || null, welcome: !!j.discount?.granted, sms: f.sms && !!f.phone });
    } catch { setError('Network error. Please try again.'); setBusy(false); }
  }
  async function login() {
    if (!/\S+@\S+\.\S+/.test(f.email) || !f.password) { setError('Enter your email and password.'); return; }
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/account/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: f.email, password: f.password }) });
      const j = await res.json();
      if (!j.ok) { setError(j.error || 'Invalid email or password.'); setBusy(false); return; }
      window.location.reload(); // re-render server-side with the signed-in client
    } catch { setError('Network error. Please try again.'); setBusy(false); }
  }

  return (
    <div>
      <h3 className="font-[family-name:var(--font-display)] text-2xl">{mode === 'signup' ? 'Create your account to book' : 'Welcome back'}</h3>
      {mode === 'signup' && (
        <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/8 p-4 text-sm text-[var(--color-ink-soft)]">
          ✦ <strong>Enjoy 15% off your first visit</strong> when you create your free account — and keep all your appointments, forms and rewards in one place.
        </div>
      )}

      {mode === 'signup' ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div><label className={label}>First name *</label><input autoComplete="given-name" className={field} value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} /></div>
          <div><label className={label}>Last name</label><input autoComplete="family-name" className={field} value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className={label}>Email *</label><input type="email" autoComplete="email" className={field} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div><label className={label}>Mobile</label><input type="tel" autoComplete="tel" className={field} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div><label className={label}>Password * (8+)</label><input type="password" autoComplete="new-password" className={field} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className={label}>Gender (optional — tailors recommendations)</label>
            <select className={field} value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}>
              <option value="">Prefer not to say</option>
              <option value="FEMALE">Female</option><option value="MALE">Male</option>
              <option value="NON_BINARY">Non-binary</option><option value="OTHER">Other</option>
            </select>
          </div>
          <input type="text" tabIndex={-1} autoComplete="off" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} className="absolute -left-[9999px] h-0 w-0" aria-hidden />
          <label className="flex items-start gap-3 text-sm text-[var(--color-stone)] sm:col-span-2"><input type="checkbox" checked={f.sms} onChange={(e) => setF({ ...f, sms: e.target.checked })} className="mt-1 h-4 w-4 accent-[var(--color-gold)]" />Text me appointment confirmations &amp; reminders.</label>
          <label className="flex items-start gap-3 text-sm text-[var(--color-stone)] sm:col-span-2"><input type="checkbox" checked={f.marketingOptIn} onChange={(e) => setF({ ...f, marketingOptIn: e.target.checked })} className="mt-1 h-4 w-4 accent-[var(--color-gold)]" />Keep me updated with offers and skincare tips.</label>
          <label className="flex items-start gap-3 text-sm text-[var(--color-stone)] sm:col-span-2"><input type="checkbox" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} className="mt-1 h-4 w-4 accent-[var(--color-gold)]" />I agree to the booking terms: my card is saved but not charged now; I’ll be charged when the service is delivered; cancellations within 24 hours are charged in full. *</label>
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          <div><label className={label}>Email</label><input type="email" className={field} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div><label className={label}>Password</label><input type="password" className={field} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
        </div>
      )}

      <div className="mt-8 flex items-center justify-between gap-4">
        <button type="button" onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')} className="text-sm font-medium text-[var(--color-stone)] hover:text-[var(--color-ink)]">
          {mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}
        </button>
        <Button onClick={() => !busy && (mode === 'signup' ? signup() : login())} variant="gold">{busy ? 'Please wait…' : mode === 'signup' ? 'Create account & continue' : 'Sign in'} <ArrowIcon /></Button>
      </div>
    </div>
  );
}

function Done({ firstName, treatment, slot }: { firstName: string; treatment?: string; slot: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-10 text-center md:p-16">
      <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-[var(--color-ink)] text-[var(--color-gold-soft)]">
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
      <h2 className="text-title">You’re booked in{firstName ? `, ${firstName}` : ''}.</h2>
      <p className="mx-auto mt-4 max-w-md text-[var(--color-stone)]">
        {treatment}{slot ? ` · ${new Date(slot).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}` : ''}.
        {' '}Your card is securely saved — no payment is taken until your treatment is delivered. We’ve emailed your confirmation.
      </p>
      <p className="mx-auto mt-4 max-w-md text-sm text-[var(--color-stone)]">
        Please <a href="/account/assessments" className="link-underline font-medium text-[var(--color-ink)]">complete your pre-treatment forms</a> before your visit, and arrive 15 minutes early for your first appointment.
      </p>
      <p className="mt-6"><a href="/account/appointments" className="link-underline text-sm font-medium text-[var(--color-ink)]">View my appointments →</a></p>
    </motion.div>
  );
}

function ElementsWrapper({ clientSecret, children }: { clientSecret: string; children: React.ReactNode }) {
  return (
    <Elements stripe={getStripe()} options={{ clientSecret, appearance: { theme: 'flat', variables: { colorPrimary: '#a98a6d', fontFamily: 'system-ui, sans-serif', borderRadius: '10px', colorBackground: '#f6ece3' } } }}>
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
    if (j.ok) onDone(); else { onError(j.error || 'Could not confirm booking.'); setSubmitting(false); }
  }
  return (
    <div>
      <PaymentElement />
      <div className="mt-6 flex justify-end"><Button onClick={submit} variant="gold" size="lg">{submitting ? 'Confirming…' : 'Confirm booking'} <ArrowIcon /></Button></div>
    </div>
  );
}
