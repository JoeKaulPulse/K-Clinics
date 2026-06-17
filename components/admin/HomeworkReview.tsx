'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Row = { id: string; files: string[]; note: string | null; status: string; feedback: string | null; reviewedBy: string | null; submittedAt: string; student: string; lesson: string; course: string };
const STATUSES = ['SUBMITTED', 'REVIEWED', 'APPROVED', 'NEEDS_REVISION'] as const;
const STATUS_LABEL: Record<string, string> = { SUBMITTED: 'Submitted', REVIEWED: 'Reviewed', APPROVED: 'Approved', NEEDS_REVISION: 'Needs revision' };
const fileName = (url: string) => { try { return decodeURIComponent(url.split('/').pop() ?? url).replace(/^\d+-/, ''); } catch { return url; } };

export function HomeworkReview({ rows }: { rows: Row[] }) {
  const router = useRouter();
  return (
    <div className="mt-6 space-y-3">
      {rows.length === 0 && <p className="text-sm text-[var(--color-stone)]">No homework has been submitted yet.</p>}
      {rows.map((r) => <ReviewCard key={r.id} row={r} onSaved={() => router.refresh()} />)}
    </div>
  );
}

function ReviewCard({ row, onSaved }: { row: Row; onSaved: () => void }) {
  const [status, setStatus] = useState(row.status);
  const [feedback, setFeedback] = useState(row.feedback ?? '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true); setSaved(false);
    const r = await fetch('/api/admin/academy/homework', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: row.id, status, feedback }) }).then((x) => x.json()).catch(() => ({ ok: false }));
    setBusy(false);
    if (r.ok) { setSaved(true); onSaved(); } else alert(r.error || 'Could not save.');
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{row.student}</p>
          <p className="text-xs text-[var(--color-stone)]">{row.course} · {row.lesson} · {new Date(row.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' })}</p>
        </div>
        <span className="rounded-full bg-[var(--color-bone)] px-3 py-1 text-xs">{STATUS_LABEL[row.status] ?? row.status}</span>
      </div>
      {row.files.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {row.files.map((u) => <li key={u}><a href={u} target="_blank" rel="noreferrer" className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs hover:border-[var(--color-gold)]">↓ {fileName(u)}</a></li>)}
        </ul>
      )}
      {row.note && <p className="mt-2 text-sm text-[var(--color-stone)]"><span className="text-[var(--color-stone-soft)]">Learner note:</span> {row.note}</p>}
      <div className="mt-3 grid gap-2 sm:grid-cols-[190px_1fr]">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm">
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} placeholder="Feedback for the learner (shown in their lesson)…" className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm" />
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button onClick={save} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Saving…' : 'Save review'}</button>
        {saved && <span className="text-xs text-[var(--color-jade)]">Saved ✓</span>}
        {row.reviewedBy && <span className="text-xs text-[var(--color-stone-soft)]">Last reviewed by {row.reviewedBy.split('@')[0]}</span>}
      </div>
    </div>
  );
}
