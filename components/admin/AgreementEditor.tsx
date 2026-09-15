'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveAgreementDraft, publishAgreement } from '@/app/admin/academy/agreement/actions';
import type { AgreementSection } from '@/lib/learner-agreement';

// BLD-1731 — owner-only edit + publish for the Learner Agreement. "Save draft"
// persists the working text without changing what learners sign; "Publish new
// version" creates a new, permanently traceable version and is what new
// learners are shown from then on. The publish button only renders when the
// page passed `isOwner` — the server action re-checks OWNER itself regardless.
const f = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)] focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]';

export function AgreementEditor({ initialSections, isOwner }: { initialSections: AgreementSection[]; isOwner: boolean }) {
  const router = useRouter();
  const [sections, setSections] = useState<AgreementSection[]>(initialSections);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const setHeading = (i: number, heading: string) => setSections((p) => p.map((s, idx) => (idx === i ? { ...s, heading } : s)));
  const setBody = (i: number, body: string) => setSections((p) => p.map((s, idx) => (idx === i ? { ...s, body } : s)));
  const removeSection = (i: number) => setSections((p) => p.filter((_, idx) => idx !== i));
  const addSection = () => setSections((p) => [...p, { heading: '', body: '' }]);

  function run(action: (s: AgreementSection[]) => Promise<{ ok: boolean; error?: string; version?: string }>, successLabel: string, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setError(null); setDone(null);
    start(async () => {
      const r = await action(sections);
      if (r.ok) { setDone(r.version ? `${successLabel} (version ${r.version})` : successLabel); router.refresh(); }
      else setError(r.error || 'Could not save.');
    });
  }

  return (
    <div className="space-y-4">
      {sections.map((s, i) => (
        <div key={i} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
          <div className="flex items-start justify-between gap-2">
            <label className="block flex-1 text-xs text-[var(--color-stone)]">Heading
              <input className={`${f} mt-1`} value={s.heading} onChange={(e) => setHeading(i, e.target.value)} />
            </label>
            <button onClick={() => removeSection(i)} className="mt-5 shrink-0 text-xs text-[var(--color-blush-deep)] hover:underline">Remove</button>
          </div>
          <label className="mt-3 block text-xs text-[var(--color-stone)]">Body
            <textarea rows={4} className={`${f} mt-1`} value={s.body} onChange={(e) => setBody(i, e.target.value)} />
          </label>
        </div>
      ))}
      <button onClick={addSection} className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm hover:bg-[var(--color-bone)]">+ Add section</button>

      {error && <p role="alert" aria-live="assertive" className="rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-3 py-2 text-sm">{error}</p>}
      {done && <p className="text-sm text-[var(--color-gold-deep)]">{done} ✓</p>}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          onClick={() => run(saveAgreementDraft, 'Draft saved')}
          disabled={pending}
          className="rounded-full border border-[var(--color-line)] px-5 py-2 text-sm font-medium hover:bg-[var(--color-bone)] disabled:opacity-50"
        >{pending ? 'Saving…' : 'Save draft'}</button>
        {isOwner && (
          <button
            onClick={() => run(publishAgreement, 'Published', 'Publish this as the new current Learner Agreement? Every learner who has not yet signed will be asked to sign this wording.')}
            disabled={pending}
            className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm font-medium text-[var(--color-porcelain)] disabled:opacity-50"
          >{pending ? 'Publishing…' : 'Publish new version'}</button>
        )}
      </div>
      <p className="text-xs text-[var(--color-stone)]">Saving a draft never changes what learners see or sign. Only Publish creates a new live version — and only the account owner can publish.</p>
    </div>
  );
}
