'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { postAction } from '@/lib/admin-actions-client';

export function ReviewActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');

  function act(action: string) {
    setError('');
    start(async () => {
      const r = await postAction('/api/admin/reviews', { id, action });
      if (r.ok) router.refresh();
      else setError(r.error || 'Couldn’t do that — try again.');
    });
  }

  const btn = 'rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50';
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === 'SUBMITTED' && (
        <>
          <button disabled={pending} onClick={() => act('approve')} className={`${btn} bg-[var(--color-ink)] text-[var(--color-porcelain)] hover:bg-[var(--color-gold-deep)]`}>Approve</button>
          <button disabled={pending} onClick={() => act('hide')} className={`${btn} border border-[var(--color-line)] hover:border-[var(--color-blush)] hover:text-[var(--color-blush-deep)]`}>Hide</button>
        </>
      )}
      {status === 'APPROVED' && (
        <>
          <button disabled={pending} onClick={() => act('publish')} className={`${btn} bg-[var(--color-gold-deep)] text-white hover:bg-[var(--color-ink)]`}>Publish</button>
          <button disabled={pending} onClick={() => act('hide')} className={`${btn} border border-[var(--color-line)] hover:border-[var(--color-blush)] hover:text-[var(--color-blush-deep)]`}>Hide</button>
        </>
      )}
      {status === 'PENDING' && (
        <button disabled={pending} onClick={() => act('resend')} className={`${btn} border border-[var(--color-line)] hover:border-[var(--color-gold)] hover:text-[var(--color-gold-deep)]`}>Re-send request</button>
      )}
      {(status === 'HIDDEN' || status === 'PUBLISHED') && (
        <button disabled={pending} onClick={() => act('approve')} className={`${btn} border border-[var(--color-line)] hover:border-[var(--color-gold)]`}>Restore</button>
      )}
      {error && <span role="alert" aria-live="assertive" className="text-xs text-[var(--color-blush-deep)]">{error}</span>}
    </div>
  );
}
