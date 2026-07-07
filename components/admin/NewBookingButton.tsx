'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { createManualBooking, searchClientsForBooking, logCallNote, resendBookingConfirmation } from '@/app/admin/bookings/create-action';
import { clinicLocalToUTC, CLINIC_TZ } from '@/lib/clinic-time';

type Variant = { id: string; name: string; durationMin: number; pricePence: number };
type Treatment = { slug: string; title: string; group: string; variants?: Variant[] };
type Found = { id: string; firstName: string; lastName: string | null; email: string; phone: string | null; hasDob: boolean; hasCard: boolean };
type Result = { bookingId: string; manageToken?: string; hasCard?: boolean; clientFirstName?: string; clientEmail?: string; clientHasEmail?: boolean };

const f = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-gold)]';
const priceLabel = (p: number) => (p > 0 ? `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}` : 'On consultation');

export function NewBookingButton({ treatments }: { treatments: Treatment[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm font-medium text-[var(--color-porcelain)] transition-colors hover:bg-[var(--color-espresso)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]">
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 3.5h3l1.2 3.2-1.7 1.3a10 10 0 0 0 4.2 4.2l1.3-1.7 3.2 1.2v3a1.5 1.5 0 0 1-1.6 1.5A13.5 13.5 0 0 1 3.5 5.1 1.5 1.5 0 0 1 5 3.5Z" />
        </svg>
        New phone booking
      </button>
      <AnimatePresence>{open && <Modal treatments={treatments} onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

function Modal({ treatments, onClose }: { treatments: Treatment[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [clash, setClash] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  // Group treatments by their group field for the two-step dropdown.
  const groups = Array.from(new Set(treatments.map((t) => t.group)));
  const firstGroup = groups[0] ?? '';
  const firstSlug = treatments.find((t) => t.group === firstGroup)?.slug ?? treatments[0]?.slug ?? '';

  // Client selection
  const [tab, setTab] = useState<'existing' | 'new'>('existing');
  const [q, setQ] = useState('');
  const [matches, setMatches] = useState<Found[]>([]);
  const [selected, setSelected] = useState<Found | null>(null);
  const [selectedGroup, setSelectedGroup] = useState(firstGroup);
  const [d, setD] = useState({ firstName: '', lastName: '', email: '', phone: '', treatmentSlug: firstSlug, variantId: treatments.find((t) => t.slug === firstSlug)?.variants?.[0]?.id ?? '', asConsultation: false, sessions: 1, date: '', time: '10:00', notes: '' });
  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD((p) => ({ ...p, [k]: v }));
  // The standalone "Consultation" category is already a consultation; the toggle
  // is for booking a *real* treatment category as a consultation (BLD-208).
  const isConsultationCat = d.treatmentSlug === 'consultation';

  const groupTreatments = treatments.filter((t) => t.group === selectedGroup);
  // The chosen category's specific service variants/areas (each its own price + time).
  const variants = treatments.find((t) => t.slug === d.treatmentSlug)?.variants ?? [];
  // Changing the treatment (directly or via its group) resets to that treatment's first area.
  const setTreatment = (slug: string) => setD((p) => ({ ...p, treatmentSlug: slug, variantId: treatments.find((t) => t.slug === slug)?.variants?.[0]?.id ?? '' }));

  function handleGroupChange(group: string) {
    setSelectedGroup(group);
    const first = treatments.find((t) => t.group === group);
    if (first) setTreatment(first.slug);
  }

  useEffect(() => {
    if (tab !== 'existing' || selected || q.trim().length < 2) { setMatches([]); return; }
    const t = setTimeout(async () => { const r = await searchClientsForBooking(q); if (r.ok) setMatches(r.clients); }, 300);
    return () => clearTimeout(t);
  }, [q, tab, selected]);

  const baseTitle = treatments.find((t) => t.slug === d.treatmentSlug)?.title || 'your treatment';
  const variantName = variants.find((v) => v.id === d.variantId)?.name;
  const treatmentTitle = (d.asConsultation && !isConsultationCat) ? `${baseTitle} — Consultation` : variantName ? `${baseTitle} — ${variantName}` : baseTitle;
  // Staff type the CLINIC's wall-clock time — convert via Europe/London, never the
  // device timezone (a roaming/misconfigured device would silently shift the booking).
  const whenLabel = d.date ? clinicLocalToUTC(d.date, d.time).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: CLINIC_TZ }) : '—';

  function submit(override = false) {
    setError('');
    if (tab === 'existing' && !selected) return setError('Find and select the client, or switch to “New client”.');
    if (tab === 'new' && (!d.firstName.trim() || !/\S+@\S+\.\S+/.test(d.email))) return setError('New client needs a first name and a valid email.');
    if (!d.date) return setError('Choose a date.');
    const startISO = clinicLocalToUTC(d.date, d.time).toISOString();
    start(async () => {
      const r = await createManualBooking({
        clientId: selected?.id,
        firstName: selected?.firstName || d.firstName,
        lastName: selected?.lastName || d.lastName,
        email: selected?.email || d.email,
        phone: selected?.phone || d.phone,
        treatmentSlug: d.treatmentSlug, variantId: d.asConsultation ? undefined : (d.variantId || undefined), asConsultation: d.asConsultation, sessions: d.sessions, startISO, notes: d.notes, override,
      });
      if (r.ok) setResult(r as Result);
      else { setError(r.error || 'Could not create booking.'); setClash(Boolean(r.clash)); }
    });
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[var(--radius-xl)] bg-[var(--color-porcelain)] p-6 shadow-[var(--shadow-lift)] sm:rounded-[var(--radius-xl)] md:p-8">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">{result ? 'Call walkthrough' : 'New phone booking'}</h2>
          <button onClick={onClose} aria-label="Close" className="text-[var(--color-stone)] hover:text-[var(--color-ink)]"><span aria-hidden="true">✕</span></button>
        </div>

        {result ? (
          <DoneView result={result} treatmentTitle={treatmentTitle} whenLabel={whenLabel} onClose={onClose} router={router} />
        ) : (
          <div className="space-y-4">
            {/* Client */}
            <div className="flex gap-2 text-sm">
              {(['existing', 'new'] as const).map((m) => (
                <button key={m} onClick={() => { setTab(m); setSelected(null); setError(''); }} className={`rounded-full px-3 py-1.5 ${tab === m ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'border border-[var(--color-line)]'}`}>{m === 'existing' ? 'Existing client' : 'New client'}</button>
              ))}
            </div>

            {tab === 'existing' ? (
              selected ? (
                <div className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm">
                  <span><strong>{selected.firstName} {selected.lastName ?? ''}</strong> · {selected.email}{selected.phone ? ` · ${selected.phone}` : ''} {selected.hasCard && <span className="ml-1 rounded-full bg-[var(--color-jade)]/15 px-2 py-0.5 text-[0.6rem] text-[var(--color-jade)]">card on file</span>}</span>
                  <button onClick={() => setSelected(null)} className="text-xs text-[var(--color-stone)] hover:underline">Change</button>
                </div>
              ) : (
                <div>
                  <input className={f} placeholder="Search name, email or phone…" value={q} onChange={(e) => setQ(e.target.value)} />
                  {matches.length > 0 && (
                    <div className="mt-1 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-line)]">
                      {matches.map((c) => (
                        <button key={c.id} onClick={() => { setSelected(c); setQ(''); }} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[var(--color-bone)]">
                          <span>{c.firstName} {c.lastName ?? ''} <span className="text-[var(--color-stone)]">· {c.email}{c.phone ? ` · ${c.phone}` : ''}</span></span>
                          {c.hasCard && <span className="rounded-full bg-[var(--color-jade)]/15 px-2 py-0.5 text-[0.6rem] text-[var(--color-jade)]">card</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input className={f} placeholder="First name" value={d.firstName} onChange={(e) => set('firstName', e.target.value)} />
                  <input className={f} placeholder="Last name" value={d.lastName} onChange={(e) => set('lastName', e.target.value)} />
                </div>
                <input className={f} type="email" placeholder="Email (for confirmation + reminders)" value={d.email} onChange={(e) => set('email', e.target.value)} />
                <input className={f} type="tel" placeholder="Phone (for reminders)" value={d.phone} onChange={(e) => set('phone', e.target.value)} />
              </div>
            )}

            {/* Appointment: group → treatment → specific service/area (its own price + time) */}
            <select className={f} value={selectedGroup} onChange={(e) => handleGroupChange(e.target.value)}>
              {groups.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            {groupTreatments.length > 1 && (
              <select className={f} value={d.treatmentSlug} onChange={(e) => setTreatment(e.target.value)}>
                {groupTreatments.map((t) => <option key={t.slug} value={t.slug}>{t.title}</option>)}
              </select>
            )}
            {variants.length > 0 && !d.asConsultation && (
              <select className={f} value={d.variantId} onChange={(e) => set('variantId', e.target.value)} aria-label="Specific service / area">
                {variants.map((v) => <option key={v.id} value={v.id}>{v.name} — {priceLabel(v.pricePence)} · {v.durationMin} min</option>)}
              </select>
            )}
            {/* Book any treatment category as a consultation (BLD-208). */}
            {!isConsultationCat && (
              <label className="flex items-center gap-2 text-sm text-[var(--color-stone)]">
                <input type="checkbox" checked={d.asConsultation} onChange={(e) => set('asConsultation', e.target.checked)} />
                Book as a consultation <span className="text-[var(--color-stone)]">(15 min · on consultation)</span>
              </label>
            )}
            {/* BLD-409: book a course of N sessions in one go. */}
            {!isConsultationCat && !d.asConsultation && (
              <label className="flex items-center justify-between gap-3 text-sm text-[var(--color-stone)]">
                Number of sessions
                <input type="number" min={1} max={50} value={d.sessions} onChange={(e) => set('sessions', Math.max(1, Math.min(50, Math.round(Number(e.target.value) || 1))))} className={`${f} w-24`} />
              </label>
            )}
            <div className="grid grid-cols-2 gap-3">
              <input className={f} type="date" value={d.date} onChange={(e) => set('date', e.target.value)} />
              <input className={f} type="time" value={d.time} onChange={(e) => set('time', e.target.value)} />
            </div>
            <textarea className={f} rows={2} placeholder="Notes (optional)" value={d.notes} onChange={(e) => set('notes', e.target.value)} />

            {error && <p role="alert" aria-live="assertive" className="rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-4 py-2.5 text-sm">{error}</p>}
            <div className="flex justify-end gap-3">
              <button onClick={onClose} className="px-4 py-2.5 text-sm text-[var(--color-stone)]">Cancel</button>
              {clash && <button onClick={() => submit(true)} disabled={pending} className="rounded-full border border-[var(--color-line)] px-5 py-2.5 text-sm font-medium hover:border-[var(--color-gold)] disabled:opacity-60">Book anyway</button>}
              <button onClick={() => submit(false)} disabled={pending} className="rounded-full bg-[var(--color-gold)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-ink)] disabled:opacity-60">{pending ? 'Creating…' : 'Create & send card link'}</button>
            </div>
            <p className="text-xs text-[var(--color-stone)]">No card is taken over the phone — the client gets a secure link to save one and confirm. Read the script on the next step.</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// A small send/resend button that reflects its own request state.
function SendBtn({ state, onClick, label = 'Send' }: { state: 'idle' | 'sending' | 'sent' | 'error'; onClick: () => void; label?: string }) {
  const txt = state === 'sending' ? 'Sending…' : state === 'sent' ? 'Resend' : state === 'error' ? 'Retry' : label;
  return (
    <button onClick={onClick} disabled={state === 'sending'} className="shrink-0 rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium hover:border-[var(--color-gold)] disabled:opacity-50">{txt}</button>
  );
}

const TICKS: Record<string, string> = {
  id: 'Identity & DOB confirmed',
  consent: 'Consent to email + SMS captured',
  policy: 'Cancellation policy explained',
};

function DoneView({ result, treatmentTitle, whenLabel, onClose, router }: { result: Result; treatmentTitle: string; whenLabel: string; onClose: () => void; router: ReturnType<typeof useRouter> }) {
  const canEmail = !!result.clientHasEmail;
  const canSendLink = !result.hasCard && canEmail;

  // ① Create-your-account + card link (passwordless clients get the magic link).
  const [linkState, setLinkState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [linkError, setLinkError] = useState('');
  async function sendLink() {
    setLinkState('sending');
    setLinkError('');
    const r = await fetch('/api/admin/bookings/request-card', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId: result.bookingId, channel: 'email' }) }).then((x) => x.json()).catch(() => ({ ok: false }));
    setLinkState(r.ok ? 'sent' : 'error');
    if (!r.ok) setLinkError(r.error || '');
  }
  // Auto-send the account + card link once on open, when there's no card on file.
  useEffect(() => { if (canSendLink) sendLink(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // ② Booking confirmation + health-form link — already sent server-side on create.
  const [confState, setConfState] = useState<'idle' | 'sending' | 'sent' | 'error'>(canEmail ? 'sent' : 'error');
  async function resendConf() {
    setConfState('sending');
    const r = await resendBookingConfirmation(result.bookingId);
    setConfState(r.ok ? 'sent' : 'error');
  }

  // ③ Log the call to the client's record.
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState('');
  const [noteState, setNoteState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const hasSomething = note.trim().length > 0 || Object.values(checks).some(Boolean);
  async function saveNote() {
    const ticked = Object.keys(TICKS).filter((k) => checks[k]).map((k) => `✓ ${TICKS[k]}`);
    const composed = [ticked.join('\n'), note.trim()].filter(Boolean).join('\n');
    if (!composed) return;
    setNoteState('saving');
    const r = await logCallNote(result.bookingId, composed);
    setNoteState(r.ok ? 'saved' : 'error');
  }

  const row = 'flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2.5';
  const sub = 'block text-xs text-[var(--color-stone)]';

  return (
    <div className="space-y-4">
      <p className="text-sm">Reserved <strong>{treatmentTitle}</strong> for <strong>{result.clientFirstName}</strong> — {whenLabel}.</p>

      {/* Read-out script */}
      <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)]/60 p-4 text-sm">
        <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--color-stone)]">Read to the client</p>
        <ul className="list-disc space-y-1.5 pl-5 text-[var(--color-ink-soft)]">
          <li>“I’ve reserved <strong>{treatmentTitle}</strong> for you on <strong>{whenLabel}</strong>.”</li>
          {result.hasCard
            ? <li>“You’ve a card securely on file, so you’re all confirmed — no payment is taken now.”</li>
            : <li>“I’ll send a secure link to your email to save a card — <strong>no payment is taken now</strong>; it confirms your spot and covers our cancellation policy.”</li>}
          <li>“Cancellations within 24 hours may incur a fee of up to the treatment price.”</li>
          <li>“For your security we <strong>never take card details over the phone</strong> — only through that secure link.”</li>
          <li>“You’ll also get a booking confirmation and a short health form to complete before your visit.”</li>
          <li><em>“Is everything correct, and do I have your consent to email the link, confirmation and reminders?”</em></li>
        </ul>
      </div>

      {/* Emails — triggered as you go through the call */}
      <div className="space-y-2">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--color-stone)]">Emails to the client</p>

        <div className={row}>
          <span className="text-sm">
            <strong>1. Create-your-account + card link</strong>
            <span className={sub}>
              {result.hasCard ? 'Card already on file — reservation confirmed.'
                : !canEmail ? 'No email on file — add one on the booking page.'
                : linkState === 'sending' ? 'Sending…'
                : linkState === 'sent' ? `Sent to ${result.clientEmail}`
                : linkState === 'error' ? (linkError ? `Send failed: ${linkError}` : 'Send failed.') : 'Ready to send.'}
            </span>
          </span>
          {result.hasCard
            ? <span className="shrink-0 rounded-full bg-[var(--color-jade)]/15 px-2 py-0.5 text-[0.6rem] text-[var(--color-jade)]">card on file</span>
            : canEmail ? <SendBtn state={linkState} onClick={sendLink} /> : null}
        </div>

        <div className={row}>
          <span className="text-sm">
            <strong>2. Booking confirmation + health form</strong>
            <span className={sub}>
              {!canEmail ? 'No email on file.'
                : confState === 'sending' ? 'Sending…'
                : confState === 'error' ? 'Send failed.'
                : `Sent to ${result.clientEmail} — includes “Complete my forms”.`}
            </span>
          </span>
          {canEmail ? <SendBtn state={confState} onClick={resendConf} label="Resend" /> : null}
        </div>
      </div>

      {/* Log the call */}
      <div className="space-y-2">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--color-stone)]">Log the call</p>
        <div className="space-y-1.5">
          {Object.entries(TICKS).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-sm text-[var(--color-ink-soft)]">
              <input type="checkbox" checked={!!checks[k]} onChange={(e) => setChecks((p) => ({ ...p, [k]: e.target.checked }))} />
              {label}
            </label>
          ))}
        </div>
        <textarea className={f} rows={2} placeholder="Call notes / outcome (saved to the client’s record)…" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex items-center gap-3">
          <button onClick={saveNote} disabled={!hasSomething || noteState === 'saving'} className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-medium hover:border-[var(--color-gold)] disabled:opacity-50">
            {noteState === 'saving' ? 'Saving…' : noteState === 'saved' ? 'Saved ✓' : 'Save to client record'}
          </button>
          {noteState === 'saved' && <span className="text-xs text-[var(--color-jade)]">Logged to the client’s timeline.</span>}
          {noteState === 'error' && <span className="text-xs text-red-600">Couldn’t save — try again.</span>}
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-[var(--color-line)] pt-4">
        <button onClick={onClose} className="px-4 py-2.5 text-sm text-[var(--color-stone)]">Close</button>
        <button onClick={() => { router.push(`/admin/bookings/${result.bookingId}`); router.refresh(); }} className="rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm font-medium text-[var(--color-porcelain)]">Open booking →</button>
      </div>
    </div>
  );
}
