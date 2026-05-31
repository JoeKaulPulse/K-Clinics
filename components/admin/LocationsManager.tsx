'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Loc = {
  id: string; name: string; slug: string; addressLine: string | null; city: string | null; postcode: string | null;
  phone: string | null; email: string | null; color: string | null; active: boolean; isPrimary: boolean; staffCount: number;
};

async function post(payload: object) {
  const res = await fetch('/api/admin/locations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return res.ok;
}

const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]';

export function LocationsManager({ locations, uk }: { locations: Loc[]; uk: boolean }) {
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {locations.map((l) => <Card key={l.id} loc={l} uk={uk} />)}
      </div>
      <AddLocation uk={uk} />
      <p className="text-xs text-[var(--color-stone)]">{L('Tip: enable “Multi-location mode” in Settings to surface location pickers across bookings and schedules.', 'Порада: увімкніть «Режим кількох локацій» у Налаштуваннях, щоб показати вибір локації в записах і розкладах.')}</p>
    </div>
  );
}

function Card({ loc, uk }: { loc: Loc; uk: boolean }) {
  const router = useRouter();
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState({ name: loc.name, addressLine: loc.addressLine || '', city: loc.city || '', postcode: loc.postcode || '', phone: loc.phone || '', email: loc.email || '', color: loc.color || '#a98a6d' });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });

  async function save() { if (await post({ op: 'update', id: loc.id, ...v })) { setEdit(false); router.refresh(); } }
  async function setPrimary() { if (await post({ op: 'setPrimary', id: loc.id })) router.refresh(); }
  async function toggleActive() { if (await post({ op: 'update', id: loc.id, active: !loc.active })) router.refresh(); }

  return (
    <div className={`rounded-[var(--radius-lg)] border bg-[var(--color-porcelain)] p-5 ${loc.active ? 'border-[var(--color-line)]' : 'border-dashed border-[var(--color-line)] opacity-60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: loc.color || 'var(--color-gold)' }} />
          <h3 className="font-[family-name:var(--font-display)] text-lg">{loc.name}</h3>
          {loc.isPrimary && <span className="rounded-full bg-[var(--color-gold)]/20 px-2 py-0.5 text-[0.6rem] uppercase tracking-wide text-[var(--color-ink)]">{L('primary', 'основна')}</span>}
        </div>
        <button onClick={() => setEdit((e) => !e)} className="text-xs text-[var(--color-stone)] hover:text-[var(--color-ink)]">{edit ? L('Close', 'Закрити') : L('Edit', 'Редагувати')}</button>
      </div>

      {!edit ? (
        <>
          <p className="mt-2 text-sm text-[var(--color-stone)]">
            {[loc.addressLine, loc.city, loc.postcode].filter(Boolean).join(', ') || L('No address set', 'Адресу не вказано')}
          </p>
          <p className="mt-1 text-xs text-[var(--color-stone-soft)]">{[loc.phone, loc.email].filter(Boolean).join(' · ')}</p>
          <div className="mt-3 flex items-center gap-4 text-xs">
            <span className="text-[var(--color-stone)]">{loc.staffCount} {L('clinician(s)', 'клініцист(ів)')}</span>
            {!loc.isPrimary && <button onClick={setPrimary} className="text-[var(--color-gold)] hover:underline">{L('Make primary', 'Зробити основною')}</button>}
            <button onClick={toggleActive} className="text-[var(--color-stone)] hover:text-[var(--color-blush)]">{loc.active ? L('Archive', 'Архівувати') : L('Reactivate', 'Відновити')}</button>
          </div>
        </>
      ) : (
        <div className="mt-3 space-y-2">
          <input value={v.name} onChange={set('name')} placeholder={L('Name', 'Назва')} className={field} />
          <input value={v.addressLine} onChange={set('addressLine')} placeholder={L('Address', 'Адреса')} className={field} />
          <div className="grid grid-cols-2 gap-2">
            <input value={v.city} onChange={set('city')} placeholder={L('City', 'Місто')} className={field} />
            <input value={v.postcode} onChange={set('postcode')} placeholder={L('Postcode', 'Індекс')} className={field} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={v.phone} onChange={set('phone')} placeholder={L('Phone', 'Телефон')} className={field} />
            <input value={v.email} onChange={set('email')} placeholder="Email" className={field} />
          </div>
          <label className="flex items-center gap-2 text-xs text-[var(--color-stone)]">{L('Calendar colour', 'Колір календаря')}
            <input type="color" value={v.color} onChange={set('color')} className="h-8 w-12 rounded border border-[var(--color-line)]" />
          </label>
          <button onClick={save} className="rounded-full bg-[var(--color-gold)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--color-ink)]">{L('Save', 'Зберегти')}</button>
        </div>
      )}
    </div>
  );
}

function AddLocation({ uk }: { uk: boolean }) {
  const router = useRouter();
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ name: '', addressLine: '', city: '', postcode: '', phone: '', email: '', color: '#7a9a8a' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });

  async function add() {
    if (!v.name.trim()) return;
    setBusy(true);
    const ok = await post({ op: 'create', ...v });
    setBusy(false);
    if (ok) { setV({ name: '', addressLine: '', city: '', postcode: '', phone: '', email: '', color: '#7a9a8a' }); setOpen(false); router.refresh(); }
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)]">+ {L('Add location', 'Додати локацію')}</button>;

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl">{L('New location', 'Нова локація')}</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={v.name} onChange={set('name')} placeholder={L('Name', 'Назва')} className={`${field} sm:col-span-2`} />
        <input value={v.addressLine} onChange={set('addressLine')} placeholder={L('Address', 'Адреса')} className={`${field} sm:col-span-2`} />
        <input value={v.city} onChange={set('city')} placeholder={L('City', 'Місто')} className={field} />
        <input value={v.postcode} onChange={set('postcode')} placeholder={L('Postcode', 'Індекс')} className={field} />
        <input value={v.phone} onChange={set('phone')} placeholder={L('Phone', 'Телефон')} className={field} />
        <input value={v.email} onChange={set('email')} placeholder="Email" className={field} />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button onClick={add} disabled={busy} className="rounded-full bg-[var(--color-gold)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--color-ink)] disabled:opacity-60">{busy ? L('Adding…', 'Додавання…') : L('Add location', 'Додати')}</button>
        <button onClick={() => setOpen(false)} className="text-sm text-[var(--color-stone)]">{L('Cancel', 'Скасувати')}</button>
      </div>
    </section>
  );
}
