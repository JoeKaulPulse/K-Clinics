'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setContractorTaskStatus } from '@/app/admin/contractor-actions';

// PRJ-63 — contracted task list with a one-tap status cycle. No client/clinical data.
export type ContractorTaskView = {
  id: string;
  title: string;
  description: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE';
  dueLabel: string | null;
  overdue: boolean;
  assigneeName?: string | null;
};

const NEXT: Record<string, 'OPEN' | 'IN_PROGRESS' | 'DONE'> = { OPEN: 'IN_PROGRESS', IN_PROGRESS: 'DONE', DONE: 'OPEN' };
const STATUS_LABEL: Record<string, string> = { OPEN: 'Open', IN_PROGRESS: 'In progress', DONE: 'Done' };
const STATUS_CLS: Record<string, string> = {
  OPEN: 'bg-[var(--color-bone)] text-[var(--color-stone)]',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  DONE: 'bg-[color-mix(in_oklab,var(--color-jade)_16%,transparent)] text-[var(--color-jade)]',
};

export function ContractorTasks({ tasks, showAssignee = false }: { tasks: ContractorTaskView[]; showAssignee?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  function cycle(t: ContractorTaskView) {
    if (pending) return;
    setBusy(t.id);
    start(async () => {
      await setContractorTaskStatus(t.id, NEXT[t.status]);
      router.refresh();
      setBusy(null);
    });
  }

  if (tasks.length === 0) {
    return <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-line)] bg-[var(--color-bone)]/40 px-6 py-8 text-center text-sm text-[var(--color-stone)]">No tasks assigned. You’re all clear.</p>;
  }

  return (
    <div className="space-y-2">
      {tasks.map((t) => (
        <div key={t.id} className={`flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4 ${t.status === 'DONE' ? 'opacity-60' : ''}`}>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-medium ${t.status === 'DONE' ? 'line-through' : ''}`}>{t.title}</p>
            {t.description && <p className="mt-0.5 text-sm text-[var(--color-stone)]">{t.description}</p>}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              {t.dueLabel && <span className={t.overdue && t.status !== 'DONE' ? 'font-medium text-[#b23b3b]' : 'text-[var(--color-stone-soft)]'}>Due {t.dueLabel}{t.overdue && t.status !== 'DONE' ? ' · overdue' : ''}</span>}
              {showAssignee && t.assigneeName && <span className="text-[var(--color-stone-soft)]">· {t.assigneeName}</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => cycle(t)}
            disabled={busy === t.id}
            title="Tap to advance status"
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${STATUS_CLS[t.status]}`}
          >
            {busy === t.id ? '…' : STATUS_LABEL[t.status]}
          </button>
        </div>
      ))}
    </div>
  );
}
