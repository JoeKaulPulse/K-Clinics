'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type LiveClass = { id: string; courseId: string; courseTitle: string; title: string; startAt: string; endAt: string | null; joinUrl: string | null; trainer: string | null; description: string | null };
type CourseRef = { id: string; title: string };

const field = 'rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-sm';
const toLocal = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');
const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

async function post(payload: object) {
  const r = await fetch('/api/admin/academy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return r.json().catch(() => ({ ok: false }));
}

export function LiveClassManager({ courses, liveClasses }: { courses: CourseRef[]; liveClasses: LiveClass[] }) {
  const [adding, setAdding] = useState(false);
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-[family-name:var(--font-display)] text-lg">Scheduled sessions</h3>
        <button onClick={() => setAdding((v) => !v)} className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm hover:border-[var(--color-gold)]">{adding ? 'Close' : '+ New session'}</button>
      </div>
      {adding && <Form courses={courses} onDone={() => setAdding(false)} />}
      <div className="mt-4 space-y-2">
        {liveClasses.length === 0 && <p className="text-sm text-[var(--color-stone)]">No live classes scheduled yet.</p>}
        {liveClasses.map((l) => <Row key={l.id} l={l} courses={courses} />)}
      </div>
    </section>
  );
}

function Row({ l, courses }: { l: LiveClass; courses: CourseRef[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  async function act(payload: object) { await post(payload); router.refresh(); }
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="font-medium">{l.title}</span>
          <span className="text-xs text-[var(--color-stone)]"> · {l.courseTitle} · {fmt(l.startAt)}</span>
          {!l.joinUrl && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-wide text-amber-800">No join link</span>}
        </div>
        <div className="flex items-center gap-3 text-xs">
          {l.joinUrl && <a href={l.joinUrl} target="_blank" rel="noopener" className="text-[var(--color-gold)] hover:underline">Meet ↗</a>}
          <button onClick={() => setEditing((e) => !e)} className="text-[var(--color-gold)] hover:underline">{editing ? 'Close' : 'Edit'}</button>
          <button onClick={() => { if (confirm('Delete this session?')) act({ op: 'removeLiveClass', id: l.id }); }} className="text-[var(--color-blush)] hover:underline">Delete</button>
        </div>
      </div>
      {editing && <div className="mt-3"><Form courses={courses} liveClass={l} onDone={() => setEditing(false)} /></div>}
    </div>
  );
}

function Form({ courses, liveClass, onDone }: { courses: CourseRef[]; liveClass?: LiveClass; onDone: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({
    courseId: liveClass?.courseId ?? courses[0]?.id ?? '',
    title: liveClass?.title ?? 'Live theory class',
    startAt: toLocal(liveClass?.startAt ?? null),
    endAt: toLocal(liveClass?.endAt ?? null),
    joinUrl: liveClass?.joinUrl ?? '',
    trainer: liveClass?.trainer ?? '',
    description: liveClass?.description ?? '',
  });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  async function save() {
    if (!f.courseId || !f.title.trim() || !f.startAt) return alert('Course, title and start time are required.');
    setBusy(true);
    await post({ op: 'upsertLiveClass', id: liveClass?.id, courseId: f.courseId, title: f.title, startAt: new Date(f.startAt).toISOString(), endAt: f.endAt ? new Date(f.endAt).toISOString() : null, joinUrl: f.joinUrl, trainer: f.trainer, description: f.description });
    setBusy(false); onDone(); router.refresh();
  }
  const L = (label: string, el: React.ReactNode) => <label className="block text-xs text-[var(--color-stone)]">{label}<br />{el}</label>;
  return (
    <div className="grid gap-3 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4 sm:grid-cols-2">
      {L('Course', <select value={f.courseId} onChange={(e) => set('courseId', e.target.value)} className={`${field} w-full`}>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>)}
      {L('Title', <input value={f.title} onChange={(e) => set('title', e.target.value)} className={`${field} w-full`} />)}
      {L('Starts', <input type="datetime-local" value={f.startAt} onChange={(e) => set('startAt', e.target.value)} className={`${field} w-full`} />)}
      {L('Ends', <input type="datetime-local" value={f.endAt} onChange={(e) => set('endAt', e.target.value)} className={`${field} w-full`} />)}
      <div className="sm:col-span-2">{L('Google Meet link', <input value={f.joinUrl} onChange={(e) => set('joinUrl', e.target.value)} placeholder="https://meet.google.com/abc-defg-hij" className={`${field} w-full`} />)}</div>
      {L('Trainer', <input value={f.trainer} onChange={(e) => set('trainer', e.target.value)} className={`${field} w-full`} />)}
      {L('Note (optional)', <input value={f.description} onChange={(e) => set('description', e.target.value)} className={`${field} w-full`} />)}
      <div className="sm:col-span-2"><button onClick={save} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-60">{busy ? 'Saving…' : 'Save session'}</button></div>
    </div>
  );
}
