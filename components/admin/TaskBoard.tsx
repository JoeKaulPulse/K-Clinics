'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Task = {
  id: string; title: string; detail: string | null; status: string; priority: string;
  dueAt: string | null; assigneeId: string | null; assigneeName: string | null;
  createdBy: string | null; completedAt: string | null; completedBy: string | null;
  clientId: string | null; clientName: string | null;
};
type Staff = { id: string; name: string };

const PRIORITY_STYLE: Record<string, string> = {
  HIGH: 'bg-[var(--color-blush)]/25 text-[var(--color-ink)]',
  NORMAL: 'bg-[var(--color-bone)] text-[var(--color-stone)]',
  LOW: 'bg-[var(--color-bone)] text-[var(--color-stone-soft)]',
};

async function post(payload: object) {
  const res = await fetch('/api/admin/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return res.ok;
}

export function TaskBoard({ meId, staff, open, done, uk }: { meId: string; staff: Staff[]; open: Task[]; done: Task[]; uk: boolean }) {
  const [filter, setFilter] = useState<'all' | 'mine'>('all');
  const shown = filter === 'mine' ? open.filter((t) => t.assigneeId === meId) : open;

  const L = (en: string, ukt: string) => (uk ? ukt : en);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr]">
      <CreateTask staff={staff} uk={uk} />

      <div className="space-y-8">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-display)] text-xl">{L('Open', 'Відкриті')} ({shown.length})</h2>
            <div className="flex gap-1 rounded-full border border-[var(--color-line)] p-0.5 text-xs">
              {(['all', 'mine'] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 ${filter === f ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'text-[var(--color-stone)]'}`}>
                  {f === 'all' ? L('All', 'Усі') : L('Mine', 'Мої')}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            {shown.length === 0 && <p className="text-sm text-[var(--color-stone)]">{L('Nothing open. 🎉', 'Немає відкритих завдань. 🎉')}</p>}
            {shown.map((t) => <Row key={t.id} t={t} staff={staff} uk={uk} />)}
          </div>
        </section>

        {done.length > 0 && (
          <section>
            <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">{L('Recently completed', 'Нещодавно завершені')}</h2>
            <div className="space-y-2 opacity-70">
              {done.map((t) => <Row key={t.id} t={t} staff={staff} uk={uk} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function CreateTask({ staff, uk }: { staff: Staff[]; uk: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [dueAt, setDueAt] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]';

  async function submit() {
    if (!title.trim()) { setMsg(L('Add a title.', 'Додайте назву.')); return; }
    setBusy(true); setMsg('');
    const ok = await post({ op: 'create', title, detail, priority, dueAt, assigneeId });
    setBusy(false);
    if (ok) { setTitle(''); setDetail(''); setDueAt(''); setAssigneeId(''); setPriority('NORMAL'); setMsg(L('Added ✓', 'Додано ✓')); router.refresh(); }
    else setMsg(L('Could not add.', 'Не вдалося додати.'));
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl">{L('New task', 'Нове завдання')}</h2>
      <div className="space-y-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={L('What needs doing?', 'Що потрібно зробити?')} className={field} />
        <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} placeholder={L('Details (optional)', 'Деталі (необовʼязково)')} className={field} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">{L('Priority', 'Пріоритет')}</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className={field}>
              <option value="LOW">{L('Low', 'Низький')}</option>
              <option value="NORMAL">{L('Normal', 'Звичайний')}</option>
              <option value="HIGH">{L('High', 'Високий')}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">{L('Due', 'Термін')}</label>
            <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={field} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">{L('Assign to', 'Призначити')}</label>
          <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={field}>
            <option value="">{L('Unassigned', 'Без виконавця')}</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={submit} disabled={busy} className="rounded-full bg-[var(--color-gold)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--color-ink)] disabled:opacity-60">
            {busy ? L('Adding…', 'Додавання…') : L('Add task', 'Додати завдання')}
          </button>
          {msg && <span className="text-sm text-[var(--color-stone)]">{msg}</span>}
        </div>
      </div>
    </section>
  );
}

function Row({ t, staff, uk }: { t: Task; staff: Staff[]; uk: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  const done = t.status === 'DONE';
  const overdue = !done && t.dueAt && new Date(t.dueAt) < new Date(new Date().toDateString());

  async function toggle() {
    setBusy(true);
    await post({ op: done ? 'reopen' : 'complete', id: t.id });
    setBusy(false); router.refresh();
  }
  async function reassign(assigneeId: string) {
    await post({ op: 'assign', id: t.id, assigneeId });
    router.refresh();
  }
  async function remove() {
    if (!confirm(L('Delete this task?', 'Видалити це завдання?'))) return;
    await post({ op: 'delete', id: t.id });
    router.refresh();
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
      <div className="flex items-start gap-3">
        <button onClick={toggle} disabled={busy} title={done ? L('Reopen', 'Відкрити знову') : L('Mark done', 'Позначити виконаним')}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${done ? 'border-[var(--color-gold)] bg-[var(--color-gold)] text-white' : 'border-[var(--color-stone-soft)] hover:border-[var(--color-gold)]'}`}>
          {done && '✓'}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-sm font-medium ${done ? 'line-through text-[var(--color-stone)]' : ''}`}>{t.title}</span>
            <span className={`rounded-full px-2 py-0.5 text-[0.6rem] uppercase tracking-wide ${PRIORITY_STYLE[t.priority]}`}>{t.priority.toLowerCase()}</span>
            {t.dueAt && <span className={`text-xs ${overdue ? 'font-medium text-[var(--color-blush)]' : 'text-[var(--color-stone-soft)]'}`}>{overdue ? '⚠ ' : ''}{new Date(t.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
          </div>
          {t.detail && <p className="mt-0.5 whitespace-pre-wrap text-sm text-[var(--color-stone)]">{t.detail}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-[var(--color-stone-soft)]">
            {t.clientId && t.clientName && <Link href={`/admin/clients/${t.clientId}`} className="text-[var(--color-gold)] hover:underline">{t.clientName}</Link>}
            {!done && (
              <select value={t.assigneeId || ''} onChange={(e) => reassign(e.target.value)} className="rounded-full border border-[var(--color-line)] bg-transparent px-2 py-0.5 text-xs">
                <option value="">{L('Unassigned', 'Без виконавця')}</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            {done && t.assigneeName && <span>{t.assigneeName}</span>}
            {done && t.completedBy && <span>· {L('done by', 'виконав')} {t.completedBy}</span>}
            <button onClick={remove} className="ml-auto hover:text-[var(--color-blush)]">{L('Delete', 'Видалити')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
