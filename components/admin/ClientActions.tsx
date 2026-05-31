'use client';

import { useState, useTransition } from 'react';
import { addNote, togglePinNote, setConsultStatus, sendManualEmail } from '@/app/admin/actions';

const STATUSES = ['NEW', 'CONTACTED', 'BOOKED', 'COMPLETED', 'CLOSED'];
const fieldCls = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]';

const NOTE_TYPE_OPTIONS = [
  { value: 'NOTE', label: 'General note' },
  { value: 'CALL', label: 'Phone call' },
  { value: 'FOLLOW_UP', label: 'Follow-up' },
  { value: 'COMPLAINT', label: 'Complaint' },
  { value: 'CLINICAL', label: 'Clinical note', clinical: true },
];

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

export function AddNote({ clientId, clinical = false }: { clientId: string; clinical?: boolean }) {
  const [val, setVal] = useState('');
  const [type, setType] = useState('NOTE');
  const [pinned, setPinned] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pending, start] = useTransition();

  const options = NOTE_TYPE_OPTIONS.filter((o) => !o.clinical || clinical);

  function submit() {
    if (!val.trim()) return;
    start(() => { addNote(clientId, val, type, undefined, pinned); setVal(''); setPinned(false); setType('NOTE'); setExpanded(false); });
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-2 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-3">
      <textarea
        className={fieldCls}
        rows={expanded ? 3 : 1}
        placeholder="Add a note…"
        value={val}
        onFocus={() => setExpanded(true)}
        onChange={(e) => setVal(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-2 py-1.5 text-xs outline-none focus:border-[var(--color-gold)]">
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-[var(--color-stone)]">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--color-gold)]" />
          Pin
        </label>
        <button disabled={pending} className="ml-auto shrink-0 rounded-[var(--radius-sm)] bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-60">
          {pending ? 'Adding…' : 'Add note'}
        </button>
      </div>
    </form>
  );
}

export function PinToggle({ noteId, clientId, pinned }: { noteId: string; clientId: string; pinned: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => togglePinNote(noteId, clientId, !pinned))}
      title={pinned ? 'Unpin' : 'Pin to top'}
      className={`text-xs transition-colors disabled:opacity-50 ${pinned ? 'text-[var(--color-gold)]' : 'text-[var(--color-stone-soft)] hover:text-[var(--color-ink)]'}`}
    >
      {pinned ? '★ Pinned' : '☆ Pin'}
    </button>
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
