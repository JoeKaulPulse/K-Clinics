'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createContractorTask } from '@/app/admin/contractor-actions';

// PRJ-63 — assign a contracted task (managers only).
export function ContractorTaskAssign({ contractors }: { contractors: { id: string; name: string }[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get('title') || '').trim();
    if (!title) { setError('Give the task a title.'); return; }
    setError(null);
    start(async () => {
      const res = await createContractorTask({
        title,
        description: String(fd.get('description') || ''),
        assigneeId: String(fd.get('assigneeId') || '') || undefined,
        dueAt: String(fd.get('dueAt') || '') || undefined,
      });
      if (res.ok) { formRef.current?.reset(); router.refresh(); }
      else setError(res.error || 'Could not create the task.');
    });
  }

  const field = 'rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]';

  return (
    <form ref={formRef} onSubmit={submit} className="mb-4 rounded-[var(--radius-md)] border border-dashed border-[var(--color-line)] bg-[var(--color-bone)]/40 p-4">
      <p className="eyebrow mb-3 text-[var(--color-stone)]">Assign a task</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input name="title" placeholder="Task (e.g. Service the air-con)" className={`${field} sm:col-span-2`} maxLength={200} />
        <input name="description" placeholder="Details (optional)" className={`${field} sm:col-span-2`} maxLength={2000} />
        <select name="assigneeId" defaultValue="" className={field}>
          <option value="">Unassigned</option>
          {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="date" name="dueAt" className={field} />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-[var(--color-porcelain)] transition-opacity hover:opacity-90 disabled:opacity-50">
          {pending ? 'Adding…' : 'Add task'}
        </button>
        {error && <span className="text-xs text-[#b23b3b]">{error}</span>}
      </div>
    </form>
  );
}
