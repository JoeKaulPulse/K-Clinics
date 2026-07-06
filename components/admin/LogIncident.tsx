'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// Staff-only Internal Incident (Accident) form, shown on a client's admin profile
// and (compact) on an appointment. Self-fetches the client's incidents so the host
// page doesn't need to load them. Never rendered in the client portal. (BLD-760)

type BookingOpt = { id: string; title: string; date: string };
type Incident = {
  id: string; occurredAt: string; category: string; severity: string; location: string | null;
  description: string; injury: string | null; actionTaken: string | null; witnesses: string | null;
  riddorReportable: boolean; createdBy: string; createdAt: string;
  booking: { id: string; treatmentTitle: string; startAt: string } | null;
};

const CATEGORIES = ['Slip/trip/fall', 'Burn/scald', 'Allergic reaction', 'Equipment', 'Needlestick', 'Other'];
const SEVERITIES = ['minor', 'moderate', 'serious'];
const SEV_CLS: Record<string, string> = {
  minor: 'bg-[var(--color-bone)] text-[var(--color-stone)]',
  moderate: 'bg-amber-100 text-amber-800',
  serious: 'bg-red-100 text-red-800',
};

function nowLocalInput(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
const fmtDate = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function LogIncident({ clientId, bookingId, bookings = [] }: { clientId: string; bookingId?: string; bookings?: BookingOpt[] }) {
  const router = useRouter();
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [f, setF] = useState({
    occurredAt: nowLocalInput(), category: 'Slip/trip/fall', severity: 'minor', bookingId: bookingId || '',
    location: '', description: '', injury: '', actionTaken: '', witnesses: '', riddorReportable: false,
  });

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/incidents?clientId=${encodeURIComponent(clientId)}`).then((r) => r.json()).catch(() => ({ ok: false }));
    if (res.ok) setIncidents(res.incidents);
    else setIncidents([]);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!f.description.trim()) { setErr('Please describe what happened.'); return; }
    setBusy(true); setErr('');
    const res = await fetch('/api/admin/incidents', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, ...f }),
    }).then((r) => r.json()).catch(() => ({ ok: false, error: 'Network error.' }));
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      setF({ occurredAt: nowLocalInput(), category: 'Slip/trip/fall', severity: 'minor', bookingId: bookingId || '', location: '', description: '', injury: '', actionTaken: '', witnesses: '', riddorReportable: false });
      await load();
      router.refresh(); // refresh the timeline (an INCIDENT interaction was created)
    } else setErr(res.error || 'Could not save the incident.');
  }

  const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]';
  const label = 'text-xs font-medium text-[var(--color-stone)]';

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Incidents</h2>
        {!open && <button onClick={() => setOpen(true)} className="text-sm text-[var(--color-gold-deep)] hover:underline">+ Log incident</button>}
      </div>
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
        {open && (
          <div className="mb-4 space-y-2.5 border-b border-[var(--color-line)] pb-4">
            <div className="grid grid-cols-2 gap-2">
              <label className="block"><span className={label}>When it happened</span>
                <input type="datetime-local" value={f.occurredAt} onChange={(e) => setF((s) => ({ ...s, occurredAt: e.target.value }))} className={`mt-1 ${field}`} />
              </label>
              <label className="block"><span className={label}>Where</span>
                <input value={f.location} onChange={(e) => setF((s) => ({ ...s, location: e.target.value }))} placeholder="e.g. treatment room 2" className={`mt-1 ${field}`} />
              </label>
              <label className="block"><span className={label}>Type</span>
                <select value={f.category} onChange={(e) => setF((s) => ({ ...s, category: e.target.value }))} className={`mt-1 ${field}`}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="block"><span className={label}>Severity</span>
                <select value={f.severity} onChange={(e) => setF((s) => ({ ...s, severity: e.target.value }))} className={`mt-1 ${field}`}>
                  {SEVERITIES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </label>
            </div>
            {bookings.length > 0 && (
              <label className="block"><span className={label}>Link to appointment (optional)</span>
                <select value={f.bookingId} onChange={(e) => setF((s) => ({ ...s, bookingId: e.target.value }))} className={`mt-1 ${field}`}>
                  <option value="">Not linked to an appointment</option>
                  {bookings.map((b) => <option key={b.id} value={b.id}>{b.title} · {b.date}</option>)}
                </select>
              </label>
            )}
            <label className="block"><span className={label}>What happened <span className="text-[var(--color-blush)]">*</span></span>
              <textarea value={f.description} onChange={(e) => setF((s) => ({ ...s, description: e.target.value }))} rows={3} placeholder="Describe the incident factually…" className={`mt-1 ${field}`} />
            </label>
            <label className="block"><span className={label}>Injury sustained (if any)</span>
              <textarea value={f.injury} onChange={(e) => setF((s) => ({ ...s, injury: e.target.value }))} rows={2} className={`mt-1 ${field}`} />
            </label>
            <label className="block"><span className={label}>Action taken / first aid given</span>
              <textarea value={f.actionTaken} onChange={(e) => setF((s) => ({ ...s, actionTaken: e.target.value }))} rows={2} className={`mt-1 ${field}`} />
            </label>
            <label className="block"><span className={label}>Witnesses</span>
              <input value={f.witnesses} onChange={(e) => setF((s) => ({ ...s, witnesses: e.target.value }))} placeholder="Names of anyone present" className={`mt-1 ${field}`} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.riddorReportable} onChange={(e) => setF((s) => ({ ...s, riddorReportable: e.target.checked }))} className="h-4 w-4 accent-[var(--color-gold)]" />
              Potentially RIDDOR-reportable
            </label>
            {err && <p role="alert" className="text-sm text-[var(--color-blush)]">{err}</p>}
            <div className="flex items-center gap-2 pt-1">
              <button onClick={submit} disabled={busy} className="rounded-full bg-[var(--color-gold)] px-4 py-2 text-sm text-white disabled:opacity-60">{busy ? 'Saving…' : 'Save incident'}</button>
              <button onClick={() => { setOpen(false); setErr(''); }} className="text-sm text-[var(--color-stone)] hover:underline">Cancel</button>
            </div>
          </div>
        )}

        {incidents === null ? (
          <p className="text-sm text-[var(--color-stone)]">Loading…</p>
        ) : incidents.length === 0 ? (
          <p className="text-sm text-[var(--color-stone)]">No incidents logged for this client.</p>
        ) : (
          <ul className="space-y-3">
            {incidents.map((i) => (
              <li key={i.id} className="text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{i.category}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${SEV_CLS[i.severity] ?? SEV_CLS.minor}`}>{i.severity}</span>
                  {i.riddorReportable && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[0.65rem] font-semibold text-red-800">RIDDOR</span>}
                  <span className="text-xs text-[var(--color-stone)]">{fmtDate(i.occurredAt)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-[var(--color-ink-soft)]">{i.description}</p>
                {i.injury && <p className="mt-1 text-xs text-[var(--color-stone)]"><span className="font-medium">Injury:</span> {i.injury}</p>}
                {i.actionTaken && <p className="mt-0.5 text-xs text-[var(--color-stone)]"><span className="font-medium">Action:</span> {i.actionTaken}</p>}
                {i.location && <p className="mt-0.5 text-xs text-[var(--color-stone)]"><span className="font-medium">Where:</span> {i.location}</p>}
                {i.witnesses && <p className="mt-0.5 text-xs text-[var(--color-stone)]"><span className="font-medium">Witnesses:</span> {i.witnesses}</p>}
                {i.booking && <p className="mt-0.5 text-xs text-[var(--color-stone)]">Appointment: {i.booking.treatmentTitle} · {new Date(i.booking.startAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
                <p className="mt-0.5 text-[0.65rem] text-[var(--color-stone)]">Logged by {i.createdBy.split('@')[0]} · {fmtDate(i.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
