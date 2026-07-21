'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AgreementSection } from '@/lib/learner-agreement';

// BLD-445: the mandatory "please read before starting" gate. Shown by the learn
// page instead of the lessons until the learner completes it; recorded on their
// enrolment so it's only asked once.
// BLD-730: the gate now also carries the Learner (Training) Agreement — the
// learner signs by typing their full name, and the signature (name + timestamp +
// wording version) is stored on the enrolment alongside the acknowledgement.
export function PreCourseGate({ slug, title, level, content, agreement }: {
  slug: string; title: string; level: string | null; content: string;
  agreement: { sections: AgreementSection[]; version: string };
}) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [signName, setSignName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function acknowledge() {
    setBusy(true); setError('');
    const r = await fetch('/api/academy/precourse-ack', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, agreementName: signName.trim() }),
    }).then((x) => x.json()).catch(() => ({ ok: false }));
    if (r.ok) router.refresh();
    else { setBusy(false); setError(r.error || 'Could not save — please try again.'); }
  }

  const paragraphs = content.split(/\n{2,}/).filter((p) => p.trim());
  const canSubmit = agreed && signName.trim().length >= 2 && !busy;
  return (
    <div className="mx-auto max-w-2xl rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-6 sm:p-8">
      {level && <p className="eyebrow mb-2 text-[var(--color-stone)]">{level}</p>}
      <h1 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl">Before you start — {title}</h1>
      <p className="mt-2 text-sm text-[var(--color-stone)]">Please read this carefully. You must acknowledge it and sign your Learner Agreement before you can access the course lessons.</p>

      {paragraphs.length > 0 && (
        <div className="mt-5 max-h-[40vh] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-4 text-sm leading-relaxed text-[var(--color-ink-soft)]">
          {paragraphs.map((p, i) => <p key={i} className="mb-3 whitespace-pre-line last:mb-0">{p}</p>)}
        </div>
      )}

      {/* Learner (Training) Agreement — BLD-730 */}
      <h2 className="mt-6 font-[family-name:var(--font-display)] text-xl">Learner Agreement</h2>
      <p className="mt-1 text-sm text-[var(--color-stone)]">Your contract for the provision of training services (version {agreement.version}).</p>
      <div className="mt-3 max-h-[40vh] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-4 text-sm leading-relaxed text-[var(--color-ink-soft)]">
        {agreement.sections.map((s) => (
          <div key={s.heading} className="mb-4 last:mb-0">
            <p className="font-medium text-[var(--color-ink)]">{s.heading}</p>
            <p className="mt-1">{s.body}</p>
          </div>
        ))}
      </div>

      <label className="mt-5 flex items-start gap-2.5 text-sm">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-gold)]" />
        <span>I have read and understood the information above, I agree to the academy’s requirements, policies and terms, and I agree to the Learner Agreement.</span>
      </label>

      <label className="mt-4 block text-sm">
        <span className="mb-1 block font-medium text-[var(--color-ink)]">Sign by typing your full name</span>
        <input
          type="text" value={signName} onChange={(e) => setSignName(e.target.value)}
          autoComplete="name" placeholder="Your full name" maxLength={120}
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3.5 py-2.5 font-[family-name:var(--font-display)] text-lg outline-none focus-visible:border-[var(--color-gold)] focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]/35"
        />
      </label>

      {error && <p role="alert" aria-live="assertive" className="mt-3 text-sm text-[var(--color-blush-deep)]">{error}</p>}
      <button onClick={acknowledge} disabled={!canSubmit} className="mt-5 rounded-full bg-[var(--color-ink)] px-6 py-2.5 text-sm font-medium text-[var(--color-porcelain)] disabled:opacity-50">
        {busy ? 'Saving…' : 'Sign and continue to my course →'}
      </button>
    </div>
  );
}
