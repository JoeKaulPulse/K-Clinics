'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const toHM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const toMin = (hm: string) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };

type Loc = { id: string; name: string; color: string | null };
type Staff = {
  id: string; name: string | null; email: string; isClinician: boolean; color: string | null; title: string | null;
  competencies: string[];
  googleConnected: boolean;
  locationIds: string[];
  schedules: { dayOfWeek: number; startMin: number; endMin: number; breakStartMin: number | null; breakEndMin: number | null; locationId: string | null }[];
  timeOff: { id: string; kind: string; startAt: string; endAt: string; reason: string | null }[];
};

export function ScheduleManager({ staff, treatments, googleConfigured, locations, multiLocation }: { staff: Staff[]; treatments: { slug: string; title: string }[]; googleConfigured: boolean; locations: Loc[]; multiLocation: boolean }) {
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

      {active && <Editor key={active.id} staff={active} treatments={treatments} googleConfigured={googleConfigured} locations={locations} multiLocation={multiLocation} />}
    </div>
  );
}

function Editor({ staff, treatments, googleConfigured, locations, multiLocation }: { staff: Staff; treatments: { slug: string; title: string }[]; googleConfigured: boolean; locations: Loc[]; multiLocation: boolean }) {
  const router = useRouter();
  const [isClinician, setIsClinician] = useState(staff.isClinician);
  const [comp, setComp] = useState<Set<string>>(new Set(staff.competencies));
  const [locs, setLocs] = useState<Set<string>>(new Set(staff.locationIds));
  const [rows, setRows] = useState(() =>
    DAYS.map((_, d) => {
      const sc = staff.schedules.find((s) => s.dayOfWeek === d);
      return {
        on: !!sc, start: sc ? toHM(sc.startMin) : '09:00', end: sc ? toHM(sc.endMin) : '18:00',
        breakStart: sc?.breakStartMin != null ? toHM(sc.breakStartMin) : '', breakEnd: sc?.breakEndMin != null ? toHM(sc.breakEndMin) : '',
        locationId: sc?.locationId || '',
      };
    }),
  );
  const [msg, setMsg] = useState('');
  // Locations this clinician may be scheduled at (selected set, else all).
  const allowedLocs = locations.filter((l) => locs.size === 0 || locs.has(l.id));

  // Returns { ok, error } so callers can surface the server's message.
  async function post(payload: object): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch('/api/admin/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) return { ok: true };
    const j = await res.json().catch(() => ({}));
    return { ok: false, error: j.error };
  }

  async function saveSchedule() {
    const blocks = rows.map((r, d) => (r.on ? {
      dayOfWeek: d, startMin: toMin(r.start), endMin: toMin(r.end),
      breakStartMin: r.breakStart ? toMin(r.breakStart) : null, breakEndMin: r.breakEnd ? toMin(r.breakEnd) : null,
      locationId: r.locationId || null,
    } : null)).filter(Boolean);
    // Replacing the rota with an empty week clears all availability — confirm.
    if (blocks.length === 0 && !confirm(`Clear ${staff.name || 'this clinician'}’s entire weekly schedule? They won’t be bookable until a new rota is set.`)) return;
    setMsg('Saving…');
    const r = await post({ op: 'setSchedule', staffId: staff.id, blocks });
    setMsg(r.ok ? 'Schedule saved ✓' : r.error || 'Could not save');
    if (r.ok) router.refresh();
  }
  async function saveClinician() {
    const r = await post({ op: 'setClinician', staffId: staff.id, isClinician, competencies: [...comp] });
    setMsg(r.ok ? 'Saved ✓' : r.error || 'Could not save');
    if (r.ok) router.refresh();
  }
  async function saveLocations() {
    const r = await post({ op: 'setLocations', staffId: staff.id, locationIds: [...locs] });
    setMsg(r.ok ? 'Locations saved ✓' : r.error || 'Could not save');
    if (r.ok) router.refresh();
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
                    className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${on ? 'border-[var(--color-gold)] bg-[var(--color-gold-deep)] text-white' : 'border-[var(--color-line)] hover:border-[var(--color-stone-soft)]'}`}>
                    {t.title}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <button onClick={saveClinician} className="mt-4 rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)]">Save</button>
      </section>

      {/* Locations this clinician works at */}
      {multiLocation && locations.length > 0 && (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
          <h2 className="mb-1 font-[family-name:var(--font-display)] text-xl">Works at</h2>
          <p className="mb-3 text-sm text-[var(--color-stone)]">Locations this clinician can be scheduled at. Their location each day is set in the weekly hours below — they’re only ever at one site per day.</p>
          <div className="flex flex-wrap gap-2">
            {locations.map((l) => {
              const on = locs.has(l.id);
              return (
                <button key={l.id} type="button" onClick={() => { const n = new Set(locs); on ? n.delete(l.id) : n.add(l.id); setLocs(n); }}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors ${on ? 'border-[var(--color-gold)] bg-[var(--color-gold-deep)] text-white' : 'border-[var(--color-line)] hover:border-[var(--color-stone-soft)]'}`}>
                  <span className="h-2 w-2 rounded-full" style={{ background: on ? 'white' : (l.color || 'var(--color-gold)') }} />
                  {l.name}
                </button>
              );
            })}
          </div>
          <button onClick={saveLocations} className="mt-4 rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)]">Save locations</button>
        </section>
      )}

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
              <span className="ml-2 hidden text-xs text-[var(--color-stone)] sm:inline">break</span>
              <input type="time" value={r.breakStart} disabled={!r.on} title="Break start (optional)" onChange={(e) => setRows((s) => s.map((x, i) => i === d ? { ...x, breakStart: e.target.value } : x))} className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm disabled:opacity-40" />
              <span className="text-[var(--color-stone)]">–</span>
              <input type="time" value={r.breakEnd} disabled={!r.on} title="Break end (optional)" onChange={(e) => setRows((s) => s.map((x, i) => i === d ? { ...x, breakEnd: e.target.value } : x))} className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm disabled:opacity-40" />
              {multiLocation && allowedLocs.length > 0 && (
                <select value={r.locationId} disabled={!r.on} onChange={(e) => setRows((s) => s.map((x, i) => i === d ? { ...x, locationId: e.target.value } : x))} className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm disabled:opacity-40">
                  <option value="">{allowedLocs.length === 1 ? allowedLocs[0].name : 'Location…'}</option>
                  {allowedLocs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              )}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--color-stone)]">Set an optional daily break (e.g. lunch) — no bookings will be offered during it.</p>
        <button onClick={saveSchedule} className="mt-4 rounded-full bg-[var(--color-gold-deep)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--color-ink)]">Save hours</button>
        {msg && <span className="ml-3 text-sm text-[var(--color-stone)]">{msg}</span>}
      </section>

      {/* Time off */}
      <TimeOff staff={staff} onChange={() => router.refresh()} />

      {/* Google Calendar */}
      <GoogleCalendar staff={staff} configured={googleConfigured} />
    </div>
  );
}

function GoogleCalendar({ staff, configured }: { staff: Staff; configured: boolean }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState('');

  async function sync() {
    setSyncing(true); setMsg('');
    const res = await fetch('/api/admin/gcal/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staffId: staff.id }) });
    setSyncing(false);
    if (res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg(`Synced ✓ ${typeof j.imported === 'number' ? `(${j.imported} busy block${j.imported === 1 ? '' : 's'})` : ''}`);
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error || 'Sync failed');
    }
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <h2 className="mb-1 font-[family-name:var(--font-display)] text-xl">Google Calendar</h2>
      <p className="mb-4 text-sm text-[var(--color-stone)]">
        Connect this person’s Google Calendar so their busy times automatically block out bookable slots.
      </p>
      {!configured ? (
        <p className="rounded-[var(--radius-sm)] border border-dashed border-[var(--color-line)] bg-[var(--color-bone)] px-4 py-3 text-sm text-[var(--color-stone)]">
          Google Calendar isn’t configured on this deployment yet. Add <code className="font-[family-name:var(--font-mono)] text-xs">GOOGLE_CLIENT_ID</code>, <code className="font-[family-name:var(--font-mono)] text-xs">GOOGLE_CLIENT_SECRET</code> and <code className="font-[family-name:var(--font-mono)] text-xs">GOOGLE_REDIRECT_URI</code> to enable it.
        </p>
      ) : staff.googleConnected ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--color-gold)]/15 px-3 py-1.5 text-sm text-[var(--color-ink)]">
            <span className="h-2 w-2 rounded-full bg-green-600" /> Connected
          </span>
          <button onClick={sync} disabled={syncing} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-60">
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
          <a href={`/api/admin/gcal/connect?staffId=${staff.id}`} className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">Reconnect</a>
          {msg && <span className="text-sm text-[var(--color-stone)]">{msg}</span>}
        </div>
      ) : (
        <a href={`/api/admin/gcal/connect?staffId=${staff.id}`} className="inline-block rounded-full bg-[var(--color-gold-deep)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--color-ink)]">
          Connect Google Calendar
        </a>
      )}
    </section>
  );
}

function TimeOff({ staff, onChange }: { staff: Staff; onChange: () => void }) {
  const [kind, setKind] = useState('HOLIDAY');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!start || !end) return;
    if (new Date(end) <= new Date(start)) { setMsg('End must be after start.'); return; }
    setBusy(true); setMsg('');
    const res = await fetch('/api/admin/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'addTimeOff', staffId: staff.id, kind, startAt: start, endAt: end, reason }) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setMsg(j.error || 'Could not add time off.'); return; }
    setStart(''); setEnd(''); setReason(''); onChange();
  }
  async function remove(id: string) {
    setBusy(true); setMsg('');
    const res = await fetch('/api/admin/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'removeTimeOff', id }) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setMsg(j.error || 'Could not remove this entry.'); return; }
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
        <button disabled={busy} onClick={add} className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-60">Add</button>
      </div>
      {msg && <p className="mt-2 text-sm text-[var(--color-blush-deep)]">{msg}</p>}
      <ul className="mt-4 divide-y divide-[var(--color-line)]">
        {staff.timeOff.length === 0 && <li className="py-2 text-sm text-[var(--color-stone)]">None scheduled.</li>}
        {staff.timeOff.map((t) => (
          <li key={t.id} className="flex items-center justify-between py-2.5 text-sm">
            <span>
              <span className="rounded-full bg-[var(--color-bone)] px-2 py-0.5 text-xs">{t.kind.toLowerCase()}</span>{' '}
              {new Date(t.startAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })} – {new Date(t.endAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}
              {t.reason ? ` · ${t.reason}` : ''}
            </span>
            <button disabled={busy} onClick={() => remove(t.id)} className="text-xs text-[var(--color-stone)] hover:text-[var(--color-blush-deep)] disabled:opacity-50">Remove</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
