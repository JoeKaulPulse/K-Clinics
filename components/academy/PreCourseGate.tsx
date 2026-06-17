'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// BLD-445: the mandatory "please read before starting" gate. Shown by the learn
// page instead of the lessons until the learner ticks the box and acknowledges;
// the acknowledgement is recorded on their enrolment so it's only asked once.
export function PreCourseGate({ slug, title, level, content }: { slug: string; title: string; level: string | null; content: string }) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function acknowledge() {
    setBusy(true); setError('');
    const r = await fetch('/api/academy/precourse-ack', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug }),
    }).then((x) => x.json()).catch(() => ({ ok: false }));
    if (r.ok) router.refresh();
    else { setBusy(false); setError(r.error || 'Could not save — please try again.'); }
  }

  const paragraphs = content.split(/\n{2,}/).filter((p) => p.trim());
  return (
    <div className="mx-auto max-w-2xl rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-6 sm:p-8">
      {level && <p className="eyebrow mb-2 text-[var(--color-stone)]">{level}</p>}
      <h1 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl">Before you start — {title}</h1>
      <p className="mt-2 text-sm text-[var(--color-stone)]">Please read this carefully. You must acknowledge it before you can access the course lessons.</p>
      <div className="mt-5 max-h-[55vh] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-4 text-sm leading-relaxed text-[var(--color-ink-soft)]">
        {paragraphs.map((p, i) => <p key={i} className="mb-3 whitespace-pre-line last:mb-0">{p}</p>)}
      </div>
      <label className="mt-5 flex items-start gap-2.5 text-sm">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-gold)]" />
        <span>I have read and understood the information above, and I agree to the academy’s requirements, policies and terms.</span>
      </label>
      {error && <p className="mt-3 text-sm text-[var(--color-blush)]">{error}</p>}
      <button onClick={acknowledge} disabled={!agreed || busy} className="mt-5 rounded-full bg-[var(--color-ink)] px-6 py-2.5 text-sm font-medium text-[var(--color-porcelain)] disabled:opacity-50">
        {busy ? 'Saving…' : 'I understand — continue to my course →'}
      </button>
    </div>
  );
}
