'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { createManualBooking, searchClientsForBooking } from '@/app/admin/bookings/create-action';

type Treatment = { slug: string; title: string };
type Found = { id: string; firstName: string; lastName: string | null; email: string; phone: string | null; hasDob: boolean; hasCard: boolean };
type Result = { bookingId: string; manageToken?: string; hasCard?: boolean; clientFirstName?: string; clientEmail?: string; clientHasEmail?: boolean };

const f = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-gold)]';

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

  // Client selection
  const [tab, setTab] = useState<'existing' | 'new'>('existing');
  const [q, setQ] = useState('');
  const [matches, setMatches] = useState<Found[]>([]);
  const [selected, setSelected] = useState<Found | null>(null);
  const [d, setD] = useState({ firstName: '', lastName: '', email: '', phone: '', treatmentSlug: treatments[0]?.slug ?? '', date: '', time: '10:00', notes: '' });
  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (tab !== 'existing' || selected || q.trim().length < 2) { setMatches([]); return; }
    const t = setTimeout(async () => { const r = await searchClientsForBooking(q); if (r.ok) setMatches(r.clients); }, 300);
    return () => clearTimeout(t);
  }, [q, tab, selected]);

  const treatmentTitle = treatments.find((t) => t.slug === d.treatmentSlug)?.title || 'your treatment';
  const whenLabel = d.date ? new Date(`${d.date}T${d.time}`).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '—';

  function submit(override = false) {
    setError('');
    if (tab === 'existing' && !selected) return setError('Find and select the client, or switch to “New client”.');
    if (tab === 'new' && (!d.firstName.trim() || !/\S+@\S+\.\S+/.test(d.email))) return setError('New client needs a first name and a valid email.');
    if (!d.date) return setError('Choose a date.');
    const startISO = new Date(`${d.date}T${d.time}`).toISOString();
    start(async () => {
      const r = await createManualBooking({
        clientId: selected?.id,
        firstName: selected?.firstName || d.firstName,
        lastName: selected?.lastName || d.lastName,
        email: selected?.email || d.email,
        phone: selected?.phone || d.phone,
        treatmentSlug: d.treatmentSlug, startISO, notes: d.notes, override,
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
          <h2 className="font-[family-name:var(--font-display)] text-2xl">{result ? 'Booking created' : 'New phone booking'}</h2>
          <button onClick={onClose} className="text-[var(--color-stone)] hover:text-[var(--color-ink)]">✕</button>
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
                          <span>{c.firstName} {c.lastName ?? ''} <span className="text-[var(--color-stone-soft)]">· {c.email}{c.phone ? ` · ${c.phone}` : ''}</span></span>
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

            {/* Appointment */}
            <select className={f} value={d.treatmentSlug} onChange={(e) => set('treatmentSlug', e.target.value)}>
              {treatments.map((t) => <option key={t.slug} value={t.slug}>{t.title}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input className={f} type="date" value={d.date} onChange={(e) => set('date', e.target.value)} />
              <input className={f} type="time" value={d.time} onChange={(e) => set('time', e.target.value)} />
            </div>
            <textarea className={f} rows={2} placeholder="Notes (optional)" value={d.notes} onChange={(e) => set('notes', e.target.value)} />

            {error && <p className="rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-4 py-2.5 text-sm">{error}</p>}
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

function DoneView({ result, treatmentTitle, whenLabel, onClose, router }: { result: Result; treatmentTitle: string; whenLabel: string; onClose: () => void; router: ReturnType<typeof useRouter> }) {
  const [sent, setSent] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const canSendLink = !result.hasCard && result.clientHasEmail;

  async function sendLink() {
    setSent('sending');
    const r = await fetch('/api/admin/bookings/request-card', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId: result.bookingId, channel: 'email' }) }).then((x) => x.json()).catch(() => ({ ok: false }));
    setSent(r.ok ? 'sent' : 'error');
  }
  // Auto-send the secure card link once, when there's no card on file.
  useEffect(() => { if (canSendLink) sendLink(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

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
          <li>“You’ll get a reminder before your appointment.”</li>
          <li><em>“Is everything correct, and do I have your consent to email the link and reminders?”</em></li>
        </ul>
      </div>

      {/* Card link status */}
      {result.hasCard ? (
        <p className="rounded-[var(--radius-sm)] bg-[var(--color-jade)]/12 px-4 py-3 text-sm text-[var(--color-jade)]">✓ Card already on file — the reservation is confirmed.</p>
      ) : canSendLink ? (
        <div className="rounded-[var(--radius-sm)] bg-[var(--color-porcelain)] px-4 py-3 text-sm">
          {sent === 'sending' && 'Sending secure card link…'}
          {sent === 'sent' && <>📧 Secure card link sent to <strong>{result.clientEmail}</strong> — ask them to tap it to save their card and confirm. <button onClick={sendLink} className="ml-1 text-[var(--color-gold-deep)] underline">Resend</button></>}
          {sent === 'error' && <>Couldn’t send the link. <button onClick={sendLink} className="text-[var(--color-gold-deep)] underline">Try again</button></>}
        </div>
      ) : (
        <p className="rounded-[var(--radius-sm)] bg-amber-50 px-4 py-3 text-sm text-amber-800">No email on file — add one on the booking page to send the secure card link.</p>
      )}

      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2.5 text-sm text-[var(--color-stone)]">Close</button>
        <button onClick={() => { router.push(`/admin/bookings/${result.bookingId}`); router.refresh(); }} className="rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm font-medium text-[var(--color-porcelain)]">Open booking →</button>
      </div>
    </div>
  );
}
