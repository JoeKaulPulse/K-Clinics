'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Task = {
  id: string; ref: string | null; title: string; detail: string | null; status: string; priority: string;
  dueAt: string | null; assigneeId: string | null; assigneeName: string | null;
  createdBy: string | null; completedAt: string | null; completedBy: string | null;
  clientId: string | null; clientName: string | null;
  parentId: string | null; parentRef: string | null;
};
type Staff = { id: string; name: string };
type TaskCommentT = { id: string; body: string; createdAt: string; authorId: string | null; authorName: string; authorPhoto: string | null; mentionIds: string[] };

const PRIORITY_STYLE: Record<string, string> = {
  HIGH: 'bg-[var(--color-blush)]/25 text-[var(--color-ink)]',
  NORMAL: 'bg-[var(--color-bone)] text-[var(--color-stone)]',
  LOW: 'bg-[var(--color-bone)] text-[var(--color-stone)]',
};

// Refs branch from the parent (TSK-12 → TSK-12.1); keep branches readable.
const MAX_REF_DEPTH = 3;
const refDepth = (t: Task) => (t.ref ? t.ref.split('.').length : 1);

async function post(payload: object) {
  const res = await fetch('/api/admin/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return res.ok;
}

/** The task's reference ID (e.g. TSK-12.1) — click to copy for tracing/search. */
function RefChip({ refId, uk }: { refId: string | null; uk: boolean }) {
  const [copied, setCopied] = useState(false);
  if (!refId) return null;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(refId).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }).catch(() => {}); }}
      title={uk ? 'Натисніть, щоб скопіювати ID завдання' : 'Click to copy the task ID'}
      className="rounded bg-[var(--color-bone)] px-1.5 py-0.5 font-mono text-[0.65rem] tracking-tight text-[var(--color-stone)] hover:bg-[var(--color-ink)] hover:text-[var(--color-porcelain)]"
    >
      {copied ? '✓' : refId}
    </button>
  );
}

export function TaskBoard({ meId, staff, open, done, uk }: { meId: string; staff: Staff[]; open: Task[]; done: Task[]; uk: boolean }) {
  const [filter, setFilter] = useState<'all' | 'mine'>('all');
  const shown = filter === 'mine' ? open.filter((t) => t.assigneeId === meId) : open;

  // Group sub-tasks under their parent when the parent is visible; otherwise a
  // sub-task renders at the top level with its lineage shown via its ref.
  const shownIds = new Set(shown.map((t) => t.id));
  const roots = shown.filter((t) => !t.parentId || !shownIds.has(t.parentId));
  const childrenOf = (id: string) => shown.filter((t) => t.parentId === id);

  const L = (en: string, ukt: string) => (uk ? ukt : en);

  const renderBranch = (t: Task, depth: number): ReactNode => (
    <div key={t.id} className={depth > 0 ? 'ml-6 border-l-2 border-[var(--color-line)] pl-3' : undefined}>
      <Row t={t} staff={staff} uk={uk} orphanSub={depth === 0 && !!t.parentId} />
      {childrenOf(t.id).length > 0 && (
        <div className="mt-2 space-y-2">{childrenOf(t.id).map((c) => renderBranch(c, depth + 1))}</div>
      )}
    </div>
  );

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
            {roots.map((t) => renderBranch(t, 0))}
          </div>
        </section>

        {done.length > 0 && (
          <section>
            <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">{L('Recently completed', 'Нещодавно завершені')}</h2>
            <div className="space-y-2 opacity-70">
              {done.map((t) => <Row key={t.id} t={t} staff={staff} uk={uk} orphanSub={false} />)}
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

function Row({ t, staff, uk, orphanSub }: { t: Task; staff: Staff[]; uk: boolean; orphanSub: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [subTitle, setSubTitle] = useState('');
  const [subBusy, setSubBusy] = useState(false);
  const [cOpen, setCOpen] = useState(false);
  const [comments, setComments] = useState<TaskCommentT[] | null>(null);
  const [cText, setCText] = useState('');
  const [cBusy, setCBusy] = useState(false);
  const L = (en: string, ukt: string) => (uk ? ukt : en);

  async function loadComments() {
    const r = await fetch('/api/admin/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'comments', taskId: t.id }) }).then((x) => x.json()).catch(() => null);
    if (r?.ok) setComments(r.comments);
  }
  function toggleComments() { const n = !cOpen; setCOpen(n); if (n && comments === null) void loadComments(); }
  async function addComment() {
    if (!cText.trim()) return;
    setCBusy(true);
    const ok = await post({ op: 'comment', taskId: t.id, body: cText.trim() });
    setCBusy(false);
    if (ok) { setCText(''); void loadComments(); }
  }
  const done = t.status === 'DONE';
  const overdue = !done && t.dueAt && new Date(t.dueAt) < new Date(new Date().toDateString());
  const canAddSub = !done && refDepth(t) < MAX_REF_DEPTH;

  async function toggle() {
    setBusy(true);
    const ok = await post({ op: done ? 'reopen' : 'complete', id: t.id });
    setBusy(false);
    if (ok) router.refresh();
    else alert(L('Could not update this task.', 'Не вдалося оновити завдання.'));
  }
  async function reassign(assigneeId: string) {
    const ok = await post({ op: 'assign', id: t.id, assigneeId });
    if (ok) router.refresh();
    else alert(L('Could not reassign this task.', 'Не вдалося перепризначити завдання.'));
  }
  async function remove() {
    if (!confirm(L('Delete this task? Any sub-tasks are deleted with it.', 'Видалити це завдання? Усі його підзавдання буде видалено разом із ним.'))) return;
    const ok = await post({ op: 'delete', id: t.id });
    if (ok) router.refresh();
    else alert(L('Could not delete this task.', 'Не вдалося видалити завдання.'));
  }
  async function addSub() {
    if (!subTitle.trim()) return;
    setSubBusy(true);
    const ok = await post({ op: 'create', title: subTitle.trim(), parentId: t.id });
    setSubBusy(false);
    if (ok) { setSubTitle(''); setSubOpen(false); router.refresh(); }
    else alert(L('Could not add the sub-task.', 'Не вдалося додати підзавдання.'));
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
            <RefChip refId={t.ref} uk={uk} />
            <span className={`text-sm font-medium ${done ? 'line-through text-[var(--color-stone)]' : ''}`}>{t.title}</span>
            <span className={`rounded-full px-2 py-0.5 text-[0.6rem] uppercase tracking-wide ${PRIORITY_STYLE[t.priority]}`}>{t.priority.toLowerCase()}</span>
            {t.dueAt && <span className={`text-xs ${overdue ? 'font-medium text-[var(--color-blush-deep)]' : 'text-[var(--color-stone)]'}`}>{overdue ? '⚠ ' : ''}{new Date(t.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
            {orphanSub && t.parentRef && <span className="text-xs text-[var(--color-stone)]">↳ {L('part of', 'частина')} {t.parentRef}</span>}
          </div>
          {t.detail && <p className="mt-0.5 whitespace-pre-wrap text-sm text-[var(--color-stone)]">{t.detail}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-[var(--color-stone)]">
            {t.clientId && t.clientName && <Link href={`/admin/clients/${t.clientId}`} className="text-[var(--color-gold-deep)] hover:underline">{t.clientName}</Link>}
            {!done && (
              <select value={t.assigneeId || ''} onChange={(e) => reassign(e.target.value)} className="rounded-full border border-[var(--color-line)] bg-transparent px-2 py-0.5 text-xs">
                <option value="">{L('Unassigned', 'Без виконавця')}</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            {canAddSub && <button onClick={() => setSubOpen((o) => !o)} className="hover:text-[var(--color-gold-deep)]">{subOpen ? L('Cancel', 'Скасувати') : `+ ${L('Sub-task', 'Підзавдання')}`}</button>}
            <button onClick={toggleComments} className="hover:text-[var(--color-gold-deep)]">💬 {L('Comments', 'Коментарі')}{comments && comments.length > 0 ? ` (${comments.length})` : ''}</button>
            {done && t.assigneeName && <span>{t.assigneeName}</span>}
            {done && t.completedBy && <span>· {L('done by', 'виконав')} {t.completedBy}</span>}
            <button onClick={remove} className="ml-auto hover:text-[var(--color-blush-deep)]">{L('Delete', 'Видалити')}</button>
          </div>
          {subOpen && (
            <div className="mt-2 flex items-center gap-2">
              <input value={subTitle} onChange={(e) => setSubTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSub()} autoFocus
                placeholder={L(`Sub-task of ${t.ref || 'this task'}…`, `Підзавдання ${t.ref || 'цього завдання'}…`)}
                className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[var(--color-gold)]" />
              <button onClick={addSub} disabled={subBusy || !subTitle.trim()} className="rounded-[var(--radius-sm)] bg-[var(--color-ink)] px-3 py-1.5 text-sm text-[var(--color-porcelain)] disabled:opacity-50">
                {subBusy ? L('Adding…', 'Додавання…') : L('Add', 'Додати')}
              </button>
            </div>
          )}
          {cOpen && (
            <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white/60 p-3">
              {comments === null ? (
                <p className="text-xs text-[var(--color-stone)]">{L('Loading…', 'Завантаження…')}</p>
              ) : comments.length === 0 ? (
                <p className="text-xs text-[var(--color-stone)]">{L('No comments yet. Start the discussion.', 'Коментарів ще немає. Почніть обговорення.')}</p>
              ) : (
                <ul className="space-y-2">
                  {comments.map((c) => (
                    <li key={c.id} className="flex gap-2">
                      <span aria-hidden className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--color-ink)] text-[0.6rem] text-[var(--color-gold-bright)]">
                        {c.authorName.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs"><span className="font-medium text-[var(--color-ink)]">{c.authorName}</span> <span className="text-[var(--color-stone)]">· {new Date(c.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></p>
                        <p className="whitespace-pre-wrap break-words text-sm text-[var(--color-ink-soft)]">{c.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-2 flex items-center gap-2">
                <input value={cText} onChange={(e) => setCText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addComment()}
                  placeholder={L('Write a comment…', 'Напишіть коментар…')}
                  className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[var(--color-gold)]" />
                <button onClick={addComment} disabled={cBusy || !cText.trim()} className="rounded-[var(--radius-sm)] bg-[var(--color-gold)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-gold-deep)] disabled:opacity-50">
                  {cBusy ? L('…', '…') : L('Send', 'Надіслати')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
