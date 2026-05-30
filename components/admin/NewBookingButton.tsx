'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { createManualBooking } from '@/app/admin/bookings/create-action';

type Treatment = { slug: string; title: string };

export function NewBookingButton({ treatments }: { treatments: Treatment[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm font-medium text-[var(--color-porcelain)] hover:bg-[var(--color-espresso)]">
        + New booking
      </button>
      <AnimatePresence>{open && <Modal treatments={treatments} onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

function Modal({ treatments, onClose }: { treatments: Treatment[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [d, setD] = useState({ firstName: '', lastName: '', email: '', phone: '', treatmentSlug: treatments[0]?.slug ?? '', date: '', time: '10:00', notes: '' });
  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD((p) => ({ ...p, [k]: v }));

  function submit() {
    setError('');
    if (!d.date) return setError('Choose a date.');
    const startISO = new Date(`${d.date}T${d.time}`).toISOString();
    start(async () => {
      const r = await createManualBooking({ ...d, startISO });
      if (r.ok) { router.push(`/admin/bookings/${r.bookingId}`); router.refresh(); }
      else setError(r.error || 'Could not create booking.');
    });
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[var(--radius-xl)] bg-[var(--color-porcelain)] p-6 shadow-[var(--shadow-lift)] sm:rounded-[var(--radius-xl)] md:p-8">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">New booking</h2>
          <button onClick={onClose} className="text-[var(--color-stone)] hover:text-[var(--color-ink)]">✕</button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <input className={f} placeholder="First name" value={d.firstName} onChange={(e) => set('firstName', e.target.value)} />
            <input className={f} placeholder="Last name" value={d.lastName} onChange={(e) => set('lastName', e.target.value)} />
          </div>
          <input className={f} type="email" placeholder="Email" value={d.email} onChange={(e) => set('email', e.target.value)} />
          <input className={f} type="tel" placeholder="Phone (optional)" value={d.phone} onChange={(e) => set('phone', e.target.value)} />
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
            <button onClick={submit} disabled={pending} className="rounded-full bg-[var(--color-gold)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-ink)] disabled:opacity-60">
              {pending ? 'Creating…' : 'Create booking'}
            </button>
          </div>
          <p className="text-xs text-[var(--color-stone)]">No card is taken now — charge on delivery from the booking page.</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

const f = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-gold)]';
