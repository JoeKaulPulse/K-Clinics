'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

const MAX_RESCHEDULES = 3;
const RESCHEDULE_WINDOW_MS = 48 * 60 * 60 * 1000;

type B = {
  treatmentTitle: string;
  treatmentSlug: string;
  startISO: string;
  status: string;
  pricePence: number;
  within24h: boolean;
  cancelled: boolean;
  rescheduleCount: number;
};

type Slot = { startISO: string; endISO: string };

const money = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const toDateStr = (iso: string) => iso.slice(0, 10);

export function ManageClient({ token, booking }: { token: string; booking: B }) {
  const [status, setStatus] = useState(booking.status);
  const [currentStartISO, setCurrentStartISO] = useState(booking.startISO);
  const [rescheduleCount, setRescheduleCount] = useState(booking.rescheduleCount);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirming, setConfirming] = useState(false);

  // Reschedule state
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [confirmingReschedule, setConfirmingReschedule] = useState(false);

  const cancelled = status === 'CANCELLED';

  const within48h = new Date(currentStartISO).getTime() - Date.now() < RESCHEDULE_WINDOW_MS;
  const canReschedule = !cancelled && rescheduleCount < MAX_RESCHEDULES && !within48h;
  const when = new Date(currentStartISO).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

  // Min date for the date picker: tomorrow.
  const minDate = toDateStr(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());

  async function loadSlots(date: string) {
    if (!date) return;
    setSlotsLoading(true);
    setSlots([]);
    setSelectedSlot('');
    try {
      const res = await fetch('/api/booking/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: booking.treatmentSlug, date }),
      });
      const j = await res.json();
      setSlots(j.slots ?? []);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }

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

  async function reschedule() {
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
        setCurrentStartISO(selectedSlot);
        setRescheduleCount((c) => c + 1);
        setMsg('Your appointment has been rescheduled. A confirmation email is on its way.');
        setShowReschedule(false);
        setConfirmingReschedule(false);
        setRescheduleDate('');
        setSlots([]);
        setSelectedSlot('');
      } else {
        setMsg(j.error || 'Could not reschedule. Please call us.');
        setConfirmingReschedule(false);
      }
    } catch { setMsg('Network error. Please call us.'); setConfirmingReschedule(false); }
    finally { setBusy(false); }
  }

  return (
    <div className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 md:p-10">
      <span className={`inline-block rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] ${cancelled ? 'bg-[var(--color-sand)] text-[var(--color-stone)]' : 'bg-[var(--color-gold)]/20 text-[var(--color-ink)]'}`}>{status}</span>
      <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl">{booking.treatmentTitle}</h2>
      <p className="mt-2 text-[var(--color-stone)]">{when}</p>
      <p className="mt-1 text-[var(--color-stone)]">{booking.pricePence > 0 ? money(booking.pricePence) : 'Assessed at your visit'}</p>

      {msg && <p className="mt-6 rounded-[var(--radius-sm)] bg-[var(--color-porcelain)] px-4 py-3 text-sm">{msg}</p>}

      {!cancelled && (
        <div className="mt-8 space-y-6 border-t border-[var(--color-line)] pt-6">

          {/* ── Reschedule ── */}
          {canReschedule && (
            <div>
              {!showReschedule ? (
                <div className="flex items-center gap-4">
                  <Button onClick={() => setShowReschedule(true)} variant="outline">Reschedule</Button>
                  <span className="text-xs text-[var(--color-stone)]">{MAX_RESCHEDULES - rescheduleCount} reschedule{MAX_RESCHEDULES - rescheduleCount !== 1 ? 's' : ''} remaining</span>
                </div>
              ) : (
                <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
                  <h3 className="mb-4 font-[family-name:var(--font-display)] text-lg">Choose a new date &amp; time</h3>
                  <div className="mb-4">
                    <label className="mb-1 block text-sm text-[var(--color-stone)]">Date</label>
                    <input
                      type="date"
                      min={minDate}
                      value={rescheduleDate}
                      onChange={(e) => { setRescheduleDate(e.target.value); loadSlots(e.target.value); setSelectedSlot(''); setConfirmingReschedule(false); }}
                      className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bone)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]"
                    />
                  </div>

                  {slotsLoading && <p className="text-sm text-[var(--color-stone)]">Checking availability…</p>}

                  {!slotsLoading && rescheduleDate && slots.length === 0 && (
                    <p className="text-sm text-[var(--color-stone)]">No availability on this date — try another.</p>
                  )}

                  {slots.length > 0 && (
                    <div className="mb-4">
                      <p className="mb-2 text-sm text-[var(--color-stone)]">{fmtDate(slots[0].startISO)}</p>
                      <div className="flex flex-wrap gap-2">
                        {slots.map((s) => (
                          <button
                            key={s.startISO}
                            onClick={() => { setSelectedSlot(s.startISO); setConfirmingReschedule(false); }}
                            className={`rounded-full border px-3 py-1 text-sm transition-colors ${selectedSlot === s.startISO ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'border-[var(--color-line)] bg-[var(--color-bone)] hover:border-[var(--color-ink)]'}`}
                          >
                            {fmtTime(s.startISO)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedSlot && !confirmingReschedule && (
                    <Button onClick={() => setConfirmingReschedule(true)} variant="gold">
                      Move to {fmtDate(selectedSlot)} at {fmtTime(selectedSlot)}
                    </Button>
                  )}

                  {confirmingReschedule && (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm">Move your booking to {fmtDate(selectedSlot)} at {fmtTime(selectedSlot)}?</span>
                      <Button onClick={reschedule} variant="gold" disabled={busy}>{busy ? 'Rescheduling…' : 'Confirm'}</Button>
                      <button onClick={() => setConfirmingReschedule(false)} className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">Back</button>
                    </div>
                  )}

                  <button onClick={() => { setShowReschedule(false); setRescheduleDate(''); setSlots([]); setSelectedSlot(''); setConfirmingReschedule(false); }} className="mt-4 block text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {!canReschedule && !cancelled && (
            <p className="text-sm text-[var(--color-stone)]">
              {rescheduleCount >= MAX_RESCHEDULES
                ? 'Maximum reschedules reached. Please call us to make further changes.'
                : within48h
                  ? 'Less than 48 hours until your appointment. Please call us to reschedule.'
                  : null}
            </p>
          )}

          {/* ── Cancel ── */}
          <div>
            {booking.within24h ? (
              <p className="mb-4 text-sm text-[var(--color-stone)]">
                This appointment is within 24 hours. Cancelling now will incur the full fee of {money(booking.pricePence)}.
              </p>
            ) : (
              <p className="mb-4 text-sm text-[var(--color-stone)]">You can cancel free of charge until 24 hours before your appointment.</p>
            )}
            {!confirming ? (
              <Button onClick={() => setConfirming(true)} variant="outline">Cancel booking</Button>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm">Are you sure?</span>
                <Button onClick={cancel} variant="gold" disabled={busy}>{busy ? 'Cancelling…' : 'Yes, cancel'}</Button>
                <button onClick={() => setConfirming(false)} className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">Keep booking</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
