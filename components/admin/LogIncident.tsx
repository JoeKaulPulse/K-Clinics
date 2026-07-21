'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// BLD-760 — Internal Incident (Accident) report. Staff-only form to record an
// accident or incident during/after a treatment. Opens from the client profile
// or the appointment page (pre-linked to the booking). POSTs to the staff-only
// /api/admin/incidents route; the injury free-text is encrypted at rest server
// side. Never rendered to clients.

const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]';

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'slip_trip', label: 'Slip / trip / fall' },
  { value: 'adverse_reaction', label: 'Adverse reaction' },
  { value: 'equipment', label: 'Equipment / device' },
  { value: 'other', label: 'Other' },
];
const SEVERITIES: { value: string; label: string }[] = [
  { value: 'minor', label: 'Minor' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'serious', label: 'Serious' },
];

const BLANK = { category: '', severity: '', location: '', description: '', injury: '', actionTaken: '', witnesses: '', riddorReportable: false };

export function LogIncident({ clientId, bookingId }: { clientId: string; bookingId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [f, setF] = useState(BLANK);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  async function save() {
    if (!f.category) return setMsg('Choose what kind of incident it was.');
    if (!f.severity) return setMsg('Choose how serious it was.');
    if (!f.description.trim()) return setMsg('Describe what happened.');
    setBusy(true); setMsg('');
    const r = await fetch('/api/admin/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, bookingId, ...f }),
    }).then((x) => x.json()).catch(() => ({ ok: false }));
    setBusy(false);
    if (r.ok) {
      setF(BLANK);
      setOpen(false);
      router.refresh();
    } else {
      setMsg(r.error || 'Could not save the incident.');
    }
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Incident report</h2>
        <span className="rounded-full bg-[var(--color-ink)] px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.14em] text-[var(--color-gold-soft)]">Staff only · encrypted</span>
      </div>
      <p className="mt-1 text-sm text-[var(--color-stone)]">
        Record an accident or incident during or after a treatment. Kept internal — never shown to the client.
        {bookingId ? ' Linked to this appointment.' : ''}
      </p>

      {!open ? (
        <button
          onClick={() => { setOpen(true); setMsg(''); }}
          className="mt-4 rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm text-[var(--color-porcelain)]"
        >
          Log incident
        </button>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs text-[var(--color-stone)]">What kind of incident? *<br />
              <select value={f.category} onChange={(e) => set('category', e.target.value)} className={`${field} mt-1`}>
                <option value="">Choose…</option>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
            <label className="text-xs text-[var(--color-stone)]">How serious? *<br />
              <select value={f.severity} onChange={(e) => set('severity', e.target.value)} className={`${field} mt-1`}>
                <option value="">Choose…</option>
                {SEVERITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
          </div>

          <label className="block text-xs text-[var(--color-stone)]">Where did it happen? (optional)<br />
            <input value={f.location} onChange={(e) => set('location', e.target.value)} className={`${field} mt-1`} placeholder="e.g. Treatment room 2, reception" />
          </label>

          <label className="block text-xs text-[var(--color-stone)]">What happened? *<br />
            <textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={3} className={`${field} mt-1`} placeholder="Describe the incident" />
          </label>

          <label className="block text-xs text-[var(--color-stone)]">Injury (if any)<br />
            <textarea value={f.injury} onChange={(e) => set('injury', e.target.value)} rows={2} className={`${field} mt-1`} placeholder="Any injury to the client or staff" />
          </label>

          <label className="block text-xs text-[var(--color-stone)]">Action taken<br />
            <textarea value={f.actionTaken} onChange={(e) => set('actionTaken', e.target.value)} rows={2} className={`${field} mt-1`} placeholder="First aid given, who was informed, next steps" />
          </label>

          <label className="block text-xs text-[var(--color-stone)]">Witnesses<br />
            <textarea value={f.witnesses} onChange={(e) => set('witnesses', e.target.value)} rows={2} className={`${field} mt-1`} placeholder="Names of anyone who saw it" />
          </label>

          <label className="flex items-start gap-2.5 text-sm text-[var(--color-ink-soft)]">
            <input type="checkbox" checked={f.riddorReportable} onChange={(e) => set('riddorReportable', e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-gold)]" />
            <span>This may be <strong>RIDDOR-reportable</strong> (a serious injury or dangerous occurrence that must be reported to the HSE).</span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={save} disabled={busy} className="rounded-full bg-[var(--color-gold-deep)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-ink)] disabled:opacity-60">
              {busy ? 'Saving…' : 'Save incident'}
            </button>
            <button onClick={() => { setOpen(false); setMsg(''); }} disabled={busy} className="text-sm text-[var(--color-stone)] hover:underline disabled:opacity-60">
              Cancel
            </button>
            {msg && <span className="text-sm text-[var(--color-blush-deep)]">{msg}</span>}
          </div>
        </div>
      )}
    </section>
  );
}
