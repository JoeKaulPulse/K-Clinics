'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setMyTaskStatus } from '@/app/contractor/actions';

// PRJ-63 — on-site task list with a one-tap status cycle, for the contractor's
// OWN tasks only. The server action re-verifies ownership against the visit;
// this component only ever sends a status (never a reassignment).
export type MyTaskView = {
  id: string;
  title: string;
  description: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE';
  dueLabel: string | null;
  overdue: boolean;
};

const NEXT: Record<string, 'OPEN' | 'IN_PROGRESS' | 'DONE'> = { OPEN: 'IN_PROGRESS', IN_PROGRESS: 'DONE', DONE: 'OPEN' };
const STATUS_LABEL: Record<string, string> = { OPEN: 'Open', IN_PROGRESS: 'In progress', DONE: 'Done' };
const STATUS_CLS: Record<string, string> = {
  OPEN: 'bg-[var(--color-bone)] text-[var(--color-stone)]',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  DONE: 'bg-[color-mix(in_oklab,var(--color-jade)_16%,transparent)] text-[var(--color-jade)]',
};

export function ContractorTaskList({ tasks }: { tasks: MyTaskView[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  function cycle(t: MyTaskView) {
    if (pending) return;
    setBusy(t.id);
    start(async () => {
      await setMyTaskStatus(t.id, NEXT[t.status]);
      router.refresh();
      setBusy(null);
    });
  }

  if (tasks.length === 0) {
    return (
      <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-line)] bg-[var(--color-bone)]/40 px-6 py-8 text-center text-sm text-[var(--color-stone)]">
        No jobs assigned to you yet. Please see reception.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4 ${t.status === 'DONE' ? 'opacity-60' : ''}`}
        >
          <div className="min-w-0 flex-1">
            <p className={`text-base font-medium ${t.status === 'DONE' ? 'line-through' : ''}`}>{t.title}</p>
            {t.description && <p className="mt-0.5 text-sm text-[var(--color-stone)]">{t.description}</p>}
            {t.dueLabel && (
              <p className={`mt-1 text-xs ${t.overdue && t.status !== 'DONE' ? 'font-medium text-[#b23b3b]' : 'text-[var(--color-stone-soft)]'}`}>
                Due {t.dueLabel}{t.overdue && t.status !== 'DONE' ? ' · overdue' : ''}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => cycle(t)}
            disabled={busy === t.id}
            title="Tap to update"
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${STATUS_CLS[t.status]}`}
          >
            {busy === t.id ? '…' : STATUS_LABEL[t.status]}
          </button>
        </div>
      ))}
    </div>
  );
}
