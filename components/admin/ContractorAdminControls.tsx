'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  approveContractor,
  blockContractor,
  unblockContractor,
  setContractorNote,
  forceCheckOut,
} from '@/app/admin/contractors/actions';

// PRJ-63 — admin action buttons for contractor profiles + on-site visits.

const btn = 'rounded-full px-3 py-1 text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50';

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });
  return { pending, run };
}

export function ApproveButton({ id }: { id: string }) {
  const { pending, run } = useAction();
  return (
    <button type="button" disabled={pending} onClick={() => run(() => approveContractor(id))}
      className={`${btn} bg-[var(--color-jade)] text-[var(--color-porcelain)]`}>
      {pending ? '…' : 'Approve'}
    </button>
  );
}

export function BlockButton({ id }: { id: string }) {
  const { pending, run } = useAction();
  return (
    <button type="button" disabled={pending} onClick={() => run(() => blockContractor(id))}
      className={`${btn} bg-[#b23b3b] text-[var(--color-porcelain)]`}>
      {pending ? '…' : 'Block'}
    </button>
  );
}

export function UnblockButton({ id }: { id: string }) {
  const { pending, run } = useAction();
  return (
    <button type="button" disabled={pending} onClick={() => run(() => unblockContractor(id))}
      className={`${btn} border border-[var(--color-line)] bg-[var(--color-porcelain)] text-[var(--color-ink)]`}>
      {pending ? '…' : 'Unblock'}
    </button>
  );
}

export function ForceCheckOutButton({ visitId }: { visitId: string }) {
  const { pending, run } = useAction();
  return (
    <button type="button" disabled={pending} onClick={() => run(() => forceCheckOut(visitId))}
      className={`${btn} border border-[var(--color-line)] bg-[var(--color-porcelain)] text-[var(--color-ink)]`}>
      {pending ? '…' : 'Check out'}
    </button>
  );
}

export function ContractorNote({ id, note }: { id: string; note: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState(note ?? '');
  const [saved, setSaved] = useState(false);
  const dirty = value !== (note ?? '');

  function save() {
    if (pending || !dirty) return;
    start(async () => {
      await setContractorNote(id, value);
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={value}
        maxLength={2000}
        onChange={(e) => { setValue(e.target.value); setSaved(false); }}
        placeholder="Add a note…"
        aria-label="Add a note"
        className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]"
      />
      <button type="button" disabled={pending || !dirty} onClick={save}
        className={`${btn} shrink-0 border border-[var(--color-line)] bg-[var(--color-bone)]/60 text-[var(--color-ink)]`}>
        {pending ? '…' : saved ? 'Saved' : 'Save'}
      </button>
    </div>
  );
}
