'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const toHM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const toMin = (hm: string) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };

type Staff = {
  id: string; name: string | null; email: string; isClinician: boolean; color: string | null; title: string | null;
  competencies: string[];
  schedules: { dayOfWeek: number; startMin: number; endMin: number }[];
  timeOff: { id: string; kind: string; startAt: string; endAt: string; reason: string | null }[];
};

export function ScheduleManager({ staff, treatments }: { staff: Staff[]; treatments: { slug: string; title: string }[] }) {
  const [activeId, setActiveId] = useState(staff[0]?.id ?? '');
  const active = staff.find((s) => s.id === activeId);

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      {/* Staff list */}
      <aside className="space-y-1">
        {staff.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveId(s.id)}
            className={`flex w-full items-center gap-3 rounded-[var(--radius-sm)] px-4 py-3 text-left text-sm transition-colors ${activeId === s.id ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'hover:bg-[var(--color-bone)]'}`}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color || 'var(--color-gold)' }} />
            <span className="flex-1">
              <span className="block font-medium">{s.name || s.email}</span>
              <span className={`block text-xs ${activeId === s.id ? 'text-[var(--color-porcelain)]/70' : 'text-[var(--color-stone)]'}`}>
                {s.isClinician ? (s.title || 'Clinician') : 'Non-clinical'}
              </span>
            </span>
          </button>
        ))}
        {staff.length === 0 && <p className="px-4 py-3 text-sm text-[var(--color-stone)]">No staff yet — add staff in Staff & access.</p>}
      </aside>

      {active && <Editor key={active.id} staff={active} treatments={treatments} />}
    </div>
  );
}

function Editor({ staff, treatments }: { staff: Staff; treatments: { slug: string; title: string }[] }) {
  const router = useRouter();
  const [isClinician, setIsClinician] = useState(staff.isClinician);
  const [comp, setComp] = useState<Set<string>>(new Set(staff.competencies));
  const [rows, setRows] = useState(() =>
    DAYS.map((_, d) => {
      const sc = staff.schedules.find((s) => s.dayOfWeek === d);
      return { on: !!sc, start: sc ? toHM(sc.startMin) : '09:00', end: sc ? toHM(sc.endMin) : '18:00' };
    }),
  );
  const [msg, setMsg] = useState('');

  async function post(payload: object) {
    const res = await fetch('/api/admin/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return res.ok;
  }

  async function saveSchedule() {
    setMsg('Saving…');
    const blocks = rows.map((r, d) => (r.on ? { dayOfWeek: d, startMin: toMin(r.start), endMin: toMin(r.end) } : null)).filter(Boolean);
    const ok = await post({ op: 'setSchedule', staffId: staff.id, blocks });
    setMsg(ok ? 'Schedule saved ✓' : 'Could not save');
    router.refresh();
  }
  async function saveClinician() {
    const ok = await post({ op: 'setClinician', staffId: staff.id, isClinician, competencies: [...comp] });
    setMsg(ok ? 'Saved ✓' : 'Could not save');
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {/* Clinician + competencies */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={isClinician} onChange={(e) => setIsClinician(e.target.checked)} className="h-4 w-4 accent-[var(--color-gold)]" />
          <span className="font-medium">Bookable as a clinician</span>
        </label>
        {isClinician && (
          <div className="mt-4">
            <p className="mb-2 text-sm text-[var(--color-stone)]">Treatments this clinician can deliver (none selected = all):</p>
            <div className="flex flex-wrap gap-2">
              {treatments.map((t) => {
                const on = comp.has(t.slug);
                return (
                  <button key={t.slug} type="button" onClick={() => { const n = new Set(comp); on ? n.delete(t.slug) : n.add(t.slug); setComp(n); }}
                    className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${on ? 'border-[var(--color-gold)] bg-[var(--color-gold)] text-white' : 'border-[var(--color-line)] hover:border-[var(--color-stone-soft)]'}`}>
                    {t.title}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <button onClick={saveClinician} className="mt-4 rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)]">Save</button>
      </section>

      {/* Weekly hours */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
        <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl">Weekly working hours</h2>
        <div className="space-y-2">
          {rows.map((r, d) => (
            <div key={d} className="flex items-center gap-3">
              <label className="flex w-28 items-center gap-2">
                <input type="checkbox" checked={r.on} onChange={(e) => setRows((s) => s.map((x, i) => i === d ? { ...x, on: e.target.checked } : x))} className="h-4 w-4 accent-[var(--color-gold)]" />
                <span className="text-sm font-medium">{DAYS[d]}</span>
              </label>
              <input type="time" value={r.start} disabled={!r.on} onChange={(e) => setRows((s) => s.map((x, i) => i === d ? { ...x, start: e.target.value } : x))} className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm disabled:opacity-40" />
              <span className="text-[var(--color-stone)]">–</span>
              <input type="time" value={r.end} disabled={!r.on} onChange={(e) => setRows((s) => s.map((x, i) => i === d ? { ...x, end: e.target.value } : x))} className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm disabled:opacity-40" />
            </div>
          ))}
        </div>
        <button onClick={saveSchedule} className="mt-5 rounded-full bg-[var(--color-gold)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--color-ink)]">Save hours</button>
        {msg && <span className="ml-3 text-sm text-[var(--color-stone)]">{msg}</span>}
      </section>

      {/* Time off */}
      <TimeOff staff={staff} onChange={() => router.refresh()} />
    </div>
  );
}

function TimeOff({ staff, onChange }: { staff: Staff; onChange: () => void }) {
  const [kind, setKind] = useState('HOLIDAY');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');

  async function add() {
    if (!start || !end) return;
    await fetch('/api/admin/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'addTimeOff', staffId: staff.id, kind, startAt: start, endAt: end, reason }) });
    setStart(''); setEnd(''); setReason(''); onChange();
  }
  async function remove(id: string) {
    await fetch('/api/admin/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'removeTimeOff', id }) });
    onChange();
  }

  const f = 'rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm';
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl">Time off & blocks</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-[var(--color-stone)]">Type<br /><select value={kind} onChange={(e) => setKind(e.target.value)} className={f}>{['HOLIDAY', 'SICK', 'TRAINING', 'BLOCKED'].map((k) => <option key={k} value={k}>{k[0] + k.slice(1).toLowerCase()}</option>)}</select></label>
        <label className="text-xs text-[var(--color-stone)]">From<br /><input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={f} /></label>
        <label className="text-xs text-[var(--color-stone)]">To<br /><input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className={f} /></label>
        <input placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} className={`${f} flex-1`} />
        <button onClick={add} className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-porcelain)]">Add</button>
      </div>
      <ul className="mt-4 divide-y divide-[var(--color-line)]">
        {staff.timeOff.length === 0 && <li className="py-2 text-sm text-[var(--color-stone)]">None scheduled.</li>}
        {staff.timeOff.map((t) => (
          <li key={t.id} className="flex items-center justify-between py-2.5 text-sm">
            <span>
              <span className="rounded-full bg-[var(--color-bone)] px-2 py-0.5 text-xs">{t.kind.toLowerCase()}</span>{' '}
              {new Date(t.startAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} – {new Date(t.endAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              {t.reason ? ` · ${t.reason}` : ''}
            </span>
            <button onClick={() => remove(t.id)} className="text-xs text-[var(--color-stone)] hover:text-[var(--color-blush)]">Remove</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
