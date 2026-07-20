'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function PatchTestEditor({ clientId, result, setBy, setAt }: { clientId: string; result: string | null; setBy: string | null; setAt: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');

  function save(value: 'PASSED' | 'FAILED' | null) {
    setErr('');
    start(async () => {
      const res = await fetch('/api/admin/patch-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, result: value }),
      });
      if (res.ok) router.refresh();
      else { const j = await res.json().catch(() => ({})); setErr(j.error || 'Could not save'); }
    });
  }

  const passed = result === 'PASSED';
  const failed = result === 'FAILED';

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Patch test</h2>
        {passed && <span aria-hidden className="text-[var(--color-gold)]">✓</span>}
        {failed && <span aria-hidden className="text-[var(--color-blush-deep)]">⚠</span>}
      </div>
      <div className={`rounded-[var(--radius-md)] border p-4 ${failed ? 'border-[var(--color-blush)] bg-[var(--color-blush)]/12' : passed ? 'border-[var(--color-line)] bg-[var(--color-porcelain)]' : 'border-[var(--color-line)] bg-[var(--color-porcelain)]'}`}>
        {result ? (
          <>
            <p className="text-sm font-medium text-[var(--color-ink)]">
              {passed ? 'Patch test completed' : 'Patch test failed'}
            </p>
            <p className="mt-1 text-xs text-[var(--color-stone)]">
              {setAt ? new Date(setAt).toLocaleDateString('en-GB') : ''}{setBy ? ` · recorded by ${setBy}` : ''}
            </p>
          </>
        ) : (
          <p className="text-sm text-[var(--color-stone)]">No patch test on record.</p>
        )}
        {err && <p role="alert" aria-live="assertive" className="mt-1 text-xs text-[var(--color-blush-deep)]">{err}</p>}
        <div className="mt-3 flex items-center gap-2">
          {!passed && <button disabled={pending} onClick={() => save('PASSED')} className="rounded-full bg-[var(--color-gold)] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-60">{pending ? 'Saving…' : 'Record passed'}</button>}
          {!failed && <button disabled={pending} onClick={() => save('FAILED')} className="rounded-full border border-[var(--color-blush)] px-4 py-1.5 text-xs font-medium text-[var(--color-blush-deep)] disabled:opacity-60">{pending ? 'Saving…' : 'Record failed'}</button>}
          {result && <button disabled={pending} onClick={() => save(null)} className="text-xs text-[var(--color-stone)] hover:text-[var(--color-blush-deep)]">Clear</button>}
        </div>
      </div>
    </section>
  );
}
