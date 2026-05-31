'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Task = { id: string; title: string; priority: string; dueAt: string | null; assigneeName: string | null };

async function post(payload: object) {
  const res = await fetch('/api/admin/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return res.ok;
}

export function ClientTasks({ clientId, tasks }: { clientId: string; tasks: Task[] }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);

  async function add() {
    if (!title.trim()) return;
    setBusy(true);
    const ok = await post({ op: 'create', title, clientId, dueAt: due });
    setBusy(false);
    if (ok) { setTitle(''); setDue(''); setAdding(false); router.refresh(); }
  }
  async function complete(id: string) {
    await post({ op: 'complete', id });
    router.refresh();
  }

  const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]';

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Tasks</h2>
        <Link href="/admin/tasks" className="text-sm text-[var(--color-gold)] hover:underline">All tasks</Link>
      </div>
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
        <ul className="space-y-2">
          {tasks.length === 0 && <li className="text-sm text-[var(--color-stone)]">No open tasks for this client.</li>}
          {tasks.map((t) => (
            <li key={t.id} className="flex items-start gap-2">
              <button onClick={() => complete(t.id)} title="Mark done" className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-[var(--color-stone-soft)] hover:border-[var(--color-gold)]" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{t.title}</p>
                <p className="text-xs text-[var(--color-stone-soft)]">
                  {t.priority.toLowerCase()}{t.dueAt ? ` · ${new Date(t.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}{t.assigneeName ? ` · ${t.assigneeName}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
        {adding ? (
          <div className="mt-3 space-y-2 border-t border-[var(--color-line)] pt-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task for this client…" className={field} autoFocus />
            <div className="flex items-center gap-2">
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={field} />
              <button onClick={add} disabled={busy} className="shrink-0 rounded-full bg-[var(--color-gold)] px-4 py-2 text-sm text-white disabled:opacity-60">{busy ? '…' : 'Add'}</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="mt-3 text-sm text-[var(--color-gold)] hover:underline">+ Add task</button>
        )}
      </div>
    </section>
  );
}
