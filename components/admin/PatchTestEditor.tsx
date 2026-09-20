'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

function todayIso() {
  // Local-date ISO (YYYY-MM-DD) for the <input type="date"> value/max — using
  // toISOString() directly would shift to UTC and can show tomorrow's date
  // for evening users west of Greenwich.
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function PatchTestEditor({
  clientId,
  result,
  setBy,
  setAt,
  recordedAt,
}: {
  clientId: string;
  result: string | null;
  setBy: string | null;
  setAt: string | null; // patchTestDate — the actual (possibly historical) test date
  recordedAt: string | null; // patchTestRecordedAt — audit timestamp of when the entry was made
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  const [testDate, setTestDate] = useState(todayIso());

  function save(value: 'PASSED' | 'FAILED' | null) {
    setErr('');
    start(async () => {
      const res = await fetch('/api/admin/patch-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, result: value, testDate: value ? testDate : undefined }),
      });
      if (res.ok) router.refresh();
      else { const j = await res.json().catch(() => ({})); setErr(j.error || 'Could not save'); }
    });
  }

  function clear() {
    if (!window.confirm('Clear this patch test record? The result will no longer show for this client.')) return;
    save(null);
  }

  const passed = result === 'PASSED';
  const failed = result === 'FAILED';

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Patch test</h2>
        {passed && <span aria-hidden className="text-[var(--color-gold-deep)]">✓</span>}
        {failed && <span aria-hidden className="text-[var(--color-blush-deep)]">⚠</span>}
      </div>
      <div className={`rounded-[var(--radius-md)] border p-4 ${failed ? 'border-[var(--color-blush)] bg-[var(--color-blush)]/12' : passed ? 'border-[var(--color-line)] bg-[var(--color-porcelain)]' : 'border-[var(--color-line)] bg-[var(--color-porcelain)]'}`}>
        {result ? (
          <>
            <p className="text-sm font-medium text-[var(--color-ink)]">
              {passed ? 'Patch test completed' : 'Patch test failed'}
              {setAt ? ` — ${new Date(setAt).toLocaleDateString('en-GB')}` : ''}
            </p>
            {(setBy || recordedAt) && (
              <p className="mt-1 text-xs text-[var(--color-stone)]">
                Recorded by {setBy || 'unknown'}{recordedAt ? ` on ${new Date(recordedAt).toLocaleDateString('en-GB')}` : ''}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-[var(--color-stone)]">No patch test on record.</p>
        )}
        {err && <p role="alert" aria-live="assertive" className="mt-1 text-xs text-[var(--color-blush-deep)]">{err}</p>}
        <div className="mt-3 flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-[var(--color-stone)]">
            Test date
            <input
              type="date"
              value={testDate}
              max={todayIso()}
              onChange={(e) => setTestDate(e.target.value)}
              disabled={pending}
              className="rounded-full border border-[var(--color-line)] bg-white px-2 py-1 text-xs text-[var(--color-ink)]"
              aria-label="Patch test date"
            />
          </label>
        </div>
        <div className="mt-2 flex items-center gap-2">
          {!passed && <button disabled={pending} onClick={() => save('PASSED')} className="rounded-full bg-[var(--color-gold-deep)] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-60">{pending ? 'Saving…' : 'Record passed'}</button>}
          {!failed && <button disabled={pending} onClick={() => save('FAILED')} className="rounded-full border border-[var(--color-blush)] px-4 py-1.5 text-xs font-medium text-[var(--color-blush-deep)] disabled:opacity-60">{pending ? 'Saving…' : 'Record failed'}</button>}
          {result && <button disabled={pending} onClick={clear} className="text-xs text-[var(--color-stone)] hover:text-[var(--color-blush-deep)]">Clear</button>}
        </div>
      </div>
    </section>
  );
}
