'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function ReviewActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function act(action: string) {
    start(async () => {
      await fetch('/api/admin/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) });
      router.refresh();
    });
  }

  const btn = 'rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50';
  return (
    <div className="flex flex-wrap gap-2">
      {status === 'SUBMITTED' && (
        <>
          <button disabled={pending} onClick={() => act('approve')} className={`${btn} bg-[var(--color-ink)] text-[var(--color-porcelain)] hover:bg-[var(--color-gold)]`}>Approve</button>
          <button disabled={pending} onClick={() => act('hide')} className={`${btn} border border-[var(--color-line)] hover:border-[var(--color-blush)] hover:text-[var(--color-blush-deep)]`}>Hide</button>
        </>
      )}
      {status === 'APPROVED' && (
        <>
          <button disabled={pending} onClick={() => act('publish')} className={`${btn} bg-[var(--color-gold)] text-white hover:bg-[var(--color-ink)]`}>Publish</button>
          <button disabled={pending} onClick={() => act('hide')} className={`${btn} border border-[var(--color-line)] hover:border-[var(--color-blush)] hover:text-[var(--color-blush-deep)]`}>Hide</button>
        </>
      )}
      {status === 'PENDING' && (
        <button disabled={pending} onClick={() => act('resend')} className={`${btn} border border-[var(--color-line)] hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]`}>Re-send request</button>
      )}
      {(status === 'HIDDEN' || status === 'PUBLISHED') && (
        <button disabled={pending} onClick={() => act('approve')} className={`${btn} border border-[var(--color-line)] hover:border-[var(--color-gold)]`}>Restore</button>
      )}
    </div>
  );
}
