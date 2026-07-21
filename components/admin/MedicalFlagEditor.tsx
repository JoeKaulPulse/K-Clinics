'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function MedicalFlagEditor({ clientId, initial, setBy, setAt }: { clientId: string; initial: string | null; setBy: string | null; setAt: string | null }) {
  const router = useRouter();
  const [flag, setFlag] = useState(initial ?? '');
  const [editing, setEditing] = useState(!initial);
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');

  function save(value: string) {
    setErr('');
    start(async () => {
      const res = await fetch('/api/admin/medical-flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, flag: value }),
      });
      if (res.ok) { setEditing(false); router.refresh(); }
      else { const j = await res.json().catch(() => ({})); setErr(j.error || 'Could not save'); }
    });
  }

  const hasFlag = !!initial;

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Medical flag</h2>
        {hasFlag && <span aria-hidden className="text-[var(--color-blush-deep)]">⚠</span>}
      </div>
      <div className={`rounded-[var(--radius-md)] border p-4 ${hasFlag ? 'border-[var(--color-blush)] bg-[var(--color-blush)]/12' : 'border-[var(--color-line)] bg-[var(--color-porcelain)]'}`}>
        {!editing ? (
          <>
            <p className="text-sm text-[var(--color-ink)]">{initial}</p>
            <p className="mt-2 text-xs text-[var(--color-stone)]">
              {setBy ? `Set by ${setBy}` : ''}{setAt ? ` · ${new Date(setAt).toLocaleDateString('en-GB')}` : ''}
            </p>
            <button onClick={() => setEditing(true)} className="mt-3 text-xs font-medium text-[var(--color-gold-deep)]">Edit</button>
          </>
        ) : (
          <>
            <textarea
              value={flag}
              onChange={(e) => setFlag(e.target.value)}
              rows={2}
              placeholder="e.g. Diabetes — confirm before laser; or Pregnant — defer injectables"
              aria-label="Medical flag"
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]"
            />
            <p className="mt-1 text-xs text-[var(--color-stone)]">A concise alert clinicians must review before each appointment. Detailed history stays in the encrypted assessments.</p>
            {err && <p role="alert" aria-live="assertive" className="mt-1 text-xs text-[var(--color-blush-deep)]">{err}</p>}
            <div className="mt-3 flex items-center gap-2">
              <button disabled={pending} onClick={() => save(flag)} className="rounded-full bg-[var(--color-gold-deep)] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-60">{pending ? 'Saving…' : 'Save flag'}</button>
              {hasFlag && <button disabled={pending} onClick={() => save('')} className="text-xs text-[var(--color-stone)] hover:text-[var(--color-blush-deep)]">Clear flag</button>}
              {hasFlag && <button onClick={() => { setFlag(initial ?? ''); setEditing(false); }} className="text-xs text-[var(--color-stone)]">Cancel</button>}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
