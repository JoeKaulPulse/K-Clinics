'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveVtctDeclaration } from '@/app/admin/academy/vtct-registrations/actions';

// BLD-1867 — owner-only editor for the Student Declaration shown on the
// public VTCT Registration page. Simpler than the Learner Agreement editor
// (components/admin/AgreementEditor.tsx) on purpose: this ticket only asks
// for the current live text to be editable, no draft/publish/versioning —
// three fields and a single Save button, backed directly by the three
// Setting keys (see app/admin/academy/vtct-registrations/actions.ts). The
// server action re-checks OWNER itself regardless of this component only
// rendering for one.
const f = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold-deep)] focus-visible:ring-2 focus-visible:ring-[var(--color-gold-deep)]';
const label = 'block text-xs font-medium text-[var(--color-stone)]';

export function VtctDeclarationEditor({ initialTitle, initialBody, initialCheckboxLabel }: {
  initialTitle: string;
  initialBody: string;
  initialCheckboxLabel: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [checkboxLabel, setCheckboxLabel] = useState(initialCheckboxLabel);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const save = () => {
    setError(null); setDone(false);
    start(async () => {
      const r = await saveVtctDeclaration({ title, body, checkboxLabel });
      if (r.ok) { setDone(true); router.refresh(); }
      else setError(r.error || 'Could not save.');
    });
  };

  return (
    <div className="space-y-4">
      <label className={label}>Title
        <input className={`${f} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
      </label>
      <label className={label}>Declaration body
        <textarea rows={8} className={`${f} mt-1`} value={body} onChange={(e) => setBody(e.target.value)} maxLength={8000} />
      </label>
      <label className={label}>Checkbox wording
        <input className={`${f} mt-1`} value={checkboxLabel} onChange={(e) => setCheckboxLabel(e.target.value)} maxLength={300} />
      </label>

      {error && <p role="alert" aria-live="assertive" className="rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-3 py-2 text-sm">{error}</p>}
      {done && <p className="text-sm text-[var(--color-gold-deep)]">Saved ✓</p>}

      <button
        onClick={save}
        disabled={pending}
        className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm font-medium text-[var(--color-porcelain)] disabled:opacity-50"
      >{pending ? 'Saving…' : 'Save declaration'}</button>
      <p className="text-xs text-[var(--color-stone)]">Changes apply immediately to the public VTCT Registration page — there is no separate draft/publish step.</p>
    </div>
  );
}
