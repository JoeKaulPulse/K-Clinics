'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function DiscountAction({ claimId, action, label }: { claimId: string; action: 'revoke' | 'restore'; label: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function run() {
    start(async () => {
      const res = await fetch('/api/admin/discount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId, action }),
      });
      if (res.ok) router.refresh();
    });
  }

  return (
    <button
      onClick={run}
      disabled={pending}
      className={`rounded-full px-3 py-1 text-xs font-medium disabled:opacity-50 ${
        action === 'revoke'
          ? 'border border-[var(--color-line)] text-[var(--color-stone)] hover:border-[var(--color-blush)] hover:text-[var(--color-ink)]'
          : 'bg-[var(--color-gold)] text-white hover:bg-[var(--color-ink)]'
      }`}
    >
      {pending ? '…' : label}
    </button>
  );
}
