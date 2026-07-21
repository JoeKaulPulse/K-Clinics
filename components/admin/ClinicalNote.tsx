'use client';

import { useState, useTransition } from 'react';
import { saveClinicalNote } from '@/app/admin/bookings/clinical-actions';

/** Per-appointment clinical treatment note for clinicians. Encrypted at rest;
 *  shows who last saved it and when. This is how a clinician records what was
 *  done during the session, as part of the client's clinical record. */
export function ClinicalNote({ bookingId, initial, savedBy, savedAt }: {
  bookingId: string; initial: string; savedBy: string | null; savedAt: string | null;
}) {
  const [note, setNote] = useState(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const dirty = note !== initial;

  function save() {
    start(async () => {
      setMsg('');
      const r = await saveClinicalNote(bookingId, note);
      setMsg(r.ok ? 'Saved ✓' : r.error || 'Could not save');
    });
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Treatment note</h2>
        <span className="rounded-full bg-[var(--color-ink)] px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.14em] text-[var(--color-gold-soft)]">Encrypted · clinical</span>
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={6}
        placeholder="What was done this session — products/settings used, observations, advice given, follow-up…"
        className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-4 py-3 text-sm leading-relaxed outline-none focus:border-[var(--color-gold)]"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={pending || !dirty} className="rounded-full bg-[var(--color-gold-deep)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--color-ink)] disabled:opacity-50">
          {pending ? 'Saving…' : 'Save note'}
        </button>
        {msg && <span className="text-sm text-[var(--color-stone)]">{msg}</span>}
        {savedAt && !dirty && (
          <span className="text-xs text-[var(--color-stone)]">Last saved {new Date(savedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{savedBy ? ` · ${savedBy}` : ''}</span>
        )}
      </div>
    </section>
  );
}
