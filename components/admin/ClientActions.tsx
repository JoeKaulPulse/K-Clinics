'use client';

import { useState, useTransition } from 'react';
import { addNote, setConsultStatus, sendManualEmail } from '@/app/admin/actions';

const STATUSES = ['NEW', 'CONTACTED', 'BOOKED', 'COMPLETED', 'CLOSED'];
const fieldCls = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]';

export function StatusSelect({ consultId, clientId, current }: { consultId: string; clientId: string; current: string }) {
  const [pending, start] = useTransition();
  return (
    <select
      defaultValue={current}
      disabled={pending}
      onChange={(e) => start(() => setConsultStatus(consultId, clientId, e.target.value))}
      className="rounded-full border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-1 text-xs outline-none focus:border-[var(--color-gold)]"
    >
      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

export function AddNote({ clientId }: { clientId: string }) {
  const [val, setVal] = useState('');
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (val.trim()) start(() => { addNote(clientId, val); setVal(''); }); }}
      className="flex gap-2"
    >
      <input className={fieldCls} placeholder="Add a note…" value={val} onChange={(e) => setVal(e.target.value)} />
      <button disabled={pending} className="shrink-0 rounded-[var(--radius-sm)] bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-60">Add</button>
    </form>
  );
}

export function SendEmail({ clientId, email }: { clientId: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();

  if (!open) return <button onClick={() => setOpen(true)} className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm hover:bg-[var(--color-bone)]">Send email</button>;

  return (
    <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
      <p className="text-xs text-[var(--color-stone)]">To: {email}</p>
      <input className={fieldCls} placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
      <textarea className={fieldCls} rows={5} placeholder="Write your message…" value={body} onChange={(e) => setBody(e.target.value)} />
      {msg && <p className="text-xs text-[var(--color-stone)]">{msg}</p>}
      <div className="flex gap-2">
        <button
          disabled={pending}
          onClick={() => start(async () => {
            const r = await sendManualEmail(clientId, email, subject, body);
            if (r?.ok) { setMsg('Sent ✓'); setSubject(''); setBody(''); } else setMsg(r?.error || 'Failed');
          })}
          className="rounded-[var(--radius-sm)] bg-[var(--color-gold)] px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {pending ? 'Sending…' : 'Send'}
        </button>
        <button onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-[var(--color-stone)]">Cancel</button>
      </div>
    </div>
  );
}
