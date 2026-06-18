'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Vacancy = { id: string; title: string; department: string | null; location: string | null; type: string | null; summary: string | null; description: string | null; active: boolean };
type App = { id: string; roleTitle: string; name: string; email: string; phone: string | null; coverNote: string | null; cvUrl: string | null; status: string; createdAt: string };

const field = 'rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-sm';
const STATUSES = ['NEW', 'REVIEWING', 'INTERVIEW', 'OFFERED', 'REJECTED', 'HIRED'];
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

async function post(payload: object) {
  return fetch('/api/admin/careers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

export function CareersManager({ vacancies, applications }: { vacancies: Vacancy[]; applications: App[] }) {
  return (
    <div className="space-y-8">
      <Applications applications={applications} />
      <Vacancies vacancies={vacancies} />
    </div>
  );
}

function Applications({ applications }: { applications: App[] }) {
  const router = useRouter();
  async function act(payload: object) { await post(payload); router.refresh(); }
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">Applications</h2>
      {applications.length === 0 ? <p className="text-sm text-[var(--color-stone)]">No applications yet.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-[var(--color-stone)]"><th scope="col" className="py-1 pr-2">Applicant</th><th scope="col" className="px-2">Role</th><th scope="col" className="px-2">Status</th><th scope="col" className="px-2"></th></tr></thead>
            <tbody>
              {applications.map((a) => (
                <tr key={a.id} className="border-t border-[var(--color-line)] align-top">
                  <td className="py-2 pr-2">
                    <span className="font-medium">{a.name}</span>
                    <span className="block text-xs text-[var(--color-stone)]">{a.email}{a.phone ? ` · ${a.phone}` : ''} · {fmt(a.createdAt)}</span>
                    {a.cvUrl && <a href={a.cvUrl} target="_blank" rel="noopener" className="text-xs text-[var(--color-gold)] hover:underline">CV / portfolio ↗</a>}
                    {a.coverNote && <span className="mt-1 block max-w-md text-xs text-[var(--color-stone)]">{a.coverNote}</span>}
                  </td>
                  <td className="px-2">{a.roleTitle}</td>
                  <td className="px-2"><select value={a.status} onChange={(e) => act({ op: 'appStatus', id: a.id, status: e.target.value })} className={field}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></td>
                  <td className="px-2 text-right"><button onClick={() => { if (confirm('Remove this application?')) act({ op: 'removeApp', id: a.id }); }} className="text-xs text-[var(--color-blush)] hover:underline">Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Vacancies({ vacancies }: { vacancies: Vacancy[] }) {
  const [adding, setAdding] = useState(false);
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Vacancies</h2>
        <button onClick={() => setAdding((v) => !v)} className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm hover:border-[var(--color-gold)]">{adding ? 'Close' : '+ New vacancy'}</button>
      </div>
      {adding && <VacancyForm onDone={() => setAdding(false)} />}
      <div className="mt-4 space-y-3">{vacancies.map((v) => <VacancyRow key={v.id} v={v} />)}</div>
    </section>
  );
}

function VacancyRow({ v }: { v: Vacancy }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  async function act(payload: object) { await post(payload); router.refresh(); }
  return (
    <div className={`rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-4 ${v.active ? '' : 'opacity-60'}`}>
      <div className="flex items-center justify-between gap-3">
        <div><span className="font-medium">{v.title}</span><span className="text-xs text-[var(--color-stone)]"> · {[v.type, v.location, v.department].filter(Boolean).join(' · ') || 'no details'}</span></div>
        <div className="flex items-center gap-3 text-xs">
          <button onClick={() => setEditing((e) => !e)} className="text-[var(--color-gold)] hover:underline">{editing ? 'Close' : 'Edit'}</button>
          <button onClick={() => act({ op: 'toggle', id: v.id, active: !v.active })} className="text-[var(--color-stone)] hover:underline">{v.active ? 'Unpublish' : 'Publish'}</button>
          <button onClick={() => { if (confirm('Delete this vacancy?')) act({ op: 'remove', id: v.id }); }} className="text-[var(--color-blush)] hover:underline">Delete</button>
        </div>
      </div>
      {editing && <div className="mt-3"><VacancyForm vacancy={v} onDone={() => setEditing(false)} /></div>}
    </div>
  );
}

function VacancyForm({ vacancy, onDone }: { vacancy?: Vacancy; onDone: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({ title: vacancy?.title ?? '', department: vacancy?.department ?? '', location: vacancy?.location ?? 'Islington, London', type: vacancy?.type ?? 'Full-time', summary: vacancy?.summary ?? '', description: vacancy?.description ?? '' });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, val: (typeof f)[K]) => setF((s) => ({ ...s, [k]: val }));
  async function save() {
    if (!f.title.trim()) return;
    setBusy(true);
    await post({ op: 'upsert', id: vacancy?.id, ...f, active: vacancy?.active ?? true });
    setBusy(false); onDone(); router.refresh();
  }
  const L = (label: string, el: React.ReactNode) => <label className="block text-xs text-[var(--color-stone)]">{label}<br />{el}</label>;
  return (
    <div className="grid gap-3 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4 sm:grid-cols-2">
      {L('Title', <input value={f.title} onChange={(e) => set('title', e.target.value)} className={`${field} w-full`} />)}
      {L('Type', <input value={f.type} onChange={(e) => set('type', e.target.value)} placeholder="Full-time" className={`${field} w-full`} />)}
      {L('Department', <input value={f.department} onChange={(e) => set('department', e.target.value)} placeholder="Clinical" className={`${field} w-full`} />)}
      {L('Location', <input value={f.location} onChange={(e) => set('location', e.target.value)} className={`${field} w-full`} />)}
      <div className="sm:col-span-2">{L('Summary (one line)', <input value={f.summary} onChange={(e) => set('summary', e.target.value)} className={`${field} w-full`} />)}</div>
      <div className="sm:col-span-2">{L('Description', <textarea rows={4} value={f.description} onChange={(e) => set('description', e.target.value)} className={`${field} w-full`} />)}</div>
      <div className="sm:col-span-2"><button onClick={save} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-60">{busy ? 'Saving…' : 'Save vacancy'}</button></div>
    </div>
  );
}
