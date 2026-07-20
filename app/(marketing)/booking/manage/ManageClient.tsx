'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';

type B = {
  treatmentTitle: string;
  treatmentSlug: string;
  startISO: string;
  status: string;
  pricePence: number;
  within24h: boolean;
  within48h: boolean;
  cancelled: boolean;
  rescheduleCount: number;
};

type Slot = { startISO: string; label: string };

const money = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}`;
const MAX_FREE = 3;

export function ManageClient({ token, booking }: { token: string; booking: B }) {
  const [status, setStatus] = useState(booking.status);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirming, setConfirming] = useState(false);

  // Reschedule state
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [rescheduleCount, setRescheduleCount] = useState(booking.rescheduleCount);

  // Clinic-local (Europe/London) — must match the confirmation email and the
  // clinic diary regardless of the viewing device's timezone (BLD-795).
  const when = new Date(booking.startISO).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
  const cancelled = status === 'CANCELLED';
  const rescheduled = status === 'RESCHEDULED';
  const done = cancelled || rescheduled || booking.status === 'COMPLETED';
  const freeLeft = Math.max(0, MAX_FREE - rescheduleCount);
  const willCharge = rescheduleCount >= MAX_FREE && booking.pricePence > 0;

  async function cancel() {
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/booking/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
      const j = await res.json();
      if (j.ok) {
        setStatus('CANCELLED');
        setMsg(j.charged ? `Your booking is cancelled. As this was within 24 hours, a fee of ${money(j.charged)} was charged.` : 'Your booking is cancelled. No charge was taken.');
      } else setMsg(j.error || 'Could not cancel. Please call us.');
    } catch { setMsg('Network error. Please call us.'); }
    finally { setBusy(false); setConfirming(false); }
  }

  async function fetchSlots(date: string, preselect?: string | null) {
    if (!date) return;
    setLoadingSlots(true); setSlots([]); setSelectedSlot(preselect ?? null);
    try {
      const res = await fetch('/api/booking/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: booking.treatmentSlug, date }),
      });
      const j = await res.json();
      // The availability endpoint returns `slots` as an array of ISO strings
      // (same contract BookingFlow consumes). Map them into {startISO,label}.
      if (j.ok && Array.isArray(j.slots)) {
        setSlots(
          (j.slots as string[])
            .filter((iso) => typeof iso === 'string')
            .map((iso) => ({
              startISO: iso,
              label: new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }),
            })),
        );
      }
    } catch { /* ignore */ }
    finally { setLoadingSlots(false); }
  }

  async function submitReschedule() {
    if (!selectedSlot) return;
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/booking/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newStartISO: selectedSlot }),
      });
      const j = await res.json();
      if (j.ok) {
        const newWhen = new Date(selectedSlot).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
        setMsg(`Your appointment has been moved to ${newWhen}.${j.charged ? ` A fee of ${money(j.charged)} was charged as you have used your ${MAX_FREE} free reschedules.` : ''} A confirmation email is on its way.`);
        setRescheduleCount((c) => c + 1);
        setShowReschedule(false);
        setSlots([]); setSelectedSlot(null); setRescheduleDate('');
      } else {
        setMsg(j.error || 'Could not reschedule. Please call us on 020 8050 0750.');
        // The slot was taken between selection and submit — refresh the list so the
        // stale time disappears and the client can repick (finding #5).
        if (j.code === 'SLOT_TAKEN' && rescheduleDate) fetchSlots(rescheduleDate);
      }
    } catch { setMsg('Network error. Please call us.'); }
    finally { setBusy(false); }
  }

  // Min date for the picker: 48h from now + 1 day buffer for display
  const minDate = new Date(Date.now() + 48 * 60 * 60 * 1000 + 60 * 60 * 1000);
  const minDateStr = minDate.toISOString().slice(0, 10);

  // Persist the reschedule picker across an accidental mid-flow refresh (finding #8):
  // date/time selections live only in component state, so a reload would silently
  // drop a half-finished reschedule. Stash them in sessionStorage, keyed by token.
  const rescheduleStoreKey = `kc-reschedule:${token}`;
  useEffect(() => {
    if (done || typeof window === 'undefined') return;
    try {
      const saved = window.sessionStorage.getItem(rescheduleStoreKey);
      if (!saved) return;
      const s = JSON.parse(saved) as { date?: string; slot?: string | null };
      if (s.date) {
        setShowReschedule(true);
        setRescheduleDate(s.date);
        fetchSlots(s.date, s.slot ?? null); // re-list times, restoring the chosen slot
      }
    } catch { /* malformed/disabled storage — ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (showReschedule && rescheduleDate) {
        window.sessionStorage.setItem(rescheduleStoreKey, JSON.stringify({ date: rescheduleDate, slot: selectedSlot }));
      } else {
        window.sessionStorage.removeItem(rescheduleStoreKey);
      }
    } catch { /* storage disabled (private mode) — non-fatal */ }
  }, [showReschedule, rescheduleDate, selectedSlot, rescheduleStoreKey]);

  return (
    <div className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 md:p-10">
      <span className={`inline-block rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] ${cancelled || rescheduled ? 'bg-[var(--color-sand)] text-[var(--color-stone)]' : 'bg-[var(--color-gold)]/20 text-[var(--color-ink)]'}`}>{status}</span>
      <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl">{booking.treatmentTitle}</h2>
      <p className="mt-2 text-[var(--color-stone)]">{when}</p>
      <p className="mt-1 text-[var(--color-stone)]">{booking.pricePence > 0 ? money(booking.pricePence) : 'Assessed at your visit'}</p>

      {msg && <p className="mt-6 rounded-[var(--radius-sm)] bg-[var(--color-porcelain)] px-4 py-3 text-sm">{msg}</p>}

      {!done && (
        <div className="mt-8 space-y-6 border-t border-[var(--color-line)] pt-6">
          {/* Reschedule section */}
          {!showReschedule ? (
            <div>
              {booking.within48h ? (
                <p className="text-sm text-[var(--color-stone)]">Reschedules require at least 48 hours notice. To change this appointment, please call us on <a href="tel:02080500750" className="font-medium text-[var(--color-ink)]">020 8050 0750</a>.</p>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-ink)]">Reschedule appointment</p>
                    <p className="text-xs text-[var(--color-stone)]">
                      {freeLeft > 0 ? `${freeLeft} free reschedule${freeLeft === 1 ? '' : 's'} remaining` : 'Full fee applies to further reschedules'}
                    </p>
                  </div>
                  <Button onClick={() => setShowReschedule(true)} variant="outline">Pick a new time</Button>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-[family-name:var(--font-display)] text-lg">Choose a new time</h3>
                <button onClick={() => { setShowReschedule(false); setSlots([]); setSelectedSlot(null); setRescheduleDate(''); }} className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">Cancel</button>
              </div>
              {willCharge && (
                <p className="mt-3 rounded-[var(--radius-sm)] bg-[var(--color-sand)] px-3 py-2 text-sm text-[var(--color-ink)]">
                  You have used your {MAX_FREE} free reschedules. Rescheduling again will incur the full treatment fee of {money(booking.pricePence)}.
                </p>
              )}
              <div className="mt-4">
                <label className="block text-xs font-medium uppercase tracking-wide text-[var(--color-stone)]">Select date</label>
                <input
                  type="date"
                  min={minDateStr}
                  value={rescheduleDate}
                  onChange={(e) => { setRescheduleDate(e.target.value); fetchSlots(e.target.value); }}
                  className="mt-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm"
                />
              </div>
              {loadingSlots && <p className="mt-3 text-sm text-[var(--color-stone)]">Loading available times&#8230;</p>}
              {!loadingSlots && slots.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-stone)]">Available times</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {slots.map((s) => (
                      <button
                        key={s.startISO}
                        aria-pressed={selectedSlot === s.startISO}
                        onClick={() => setSelectedSlot(s.startISO)}
                        className={`rounded-full px-3 py-1 text-sm transition ${selectedSlot === s.startISO ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'border border-[var(--color-line)] hover:border-[var(--color-gold)]'}`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {!loadingSlots && rescheduleDate && slots.length === 0 && (
                <p className="mt-3 text-sm text-[var(--color-stone)]">No availability on this date. Please try another day or call us.</p>
              )}
              {selectedSlot && (
                <Button onClick={submitReschedule} variant="gold" className="mt-5">
                  {busy ? 'Rescheduling…' : `Confirm new time${willCharge ? ` — ${money(booking.pricePence)} applies` : ''}`}
                </Button>
              )}
            </div>
          )}

          {/* Cancel section */}
          <div>
            {booking.within24h ? (
              <p className="mb-3 text-sm text-[var(--color-stone)]">
                Cancelling now (within 24 hours) will incur the full fee of {money(booking.pricePence)}.
              </p>
            ) : (
              <p className="mb-3 text-sm text-[var(--color-stone)]">You can cancel free of charge until 24 hours before your appointment.</p>
            )}
            {!confirming ? (
              <Button onClick={() => setConfirming(true)} variant="outline">Cancel booking</Button>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm">Are you sure?</span>
                <Button onClick={cancel} variant="gold">{busy ? 'Cancelling…' : 'Yes, cancel'}</Button>
                <button onClick={() => setConfirming(false)} className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">Keep booking</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
