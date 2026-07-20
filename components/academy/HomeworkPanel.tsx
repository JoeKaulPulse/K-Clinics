'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { HomeworkSubmissionView } from '@/lib/lms';

// BLD-446: in-lesson homework submission for the learner. Shows the current
// submission + tutor feedback/status, and an upload form when nothing is submitted
// yet or the tutor asked for a revision.
const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: 'Submitted — awaiting review',
  REVIEWED: 'Reviewed by your tutor',
  APPROVED: 'Approved ✓',
  NEEDS_REVISION: 'Needs revision',
};
const fileName = (url: string) => { try { return decodeURIComponent(url.split('/').pop() ?? url).replace(/^\d+-/, ''); } catch { return url; } };

// The panel renders in two places: the dark immersive player and the light course
// outline. `tone` swaps the colour set so it sits correctly on either surface.
const TONES = {
  dark: { box: 'border-white/10 bg-white/5', head: 'text-white/40', sub: 'border-white/10 bg-white/5', strong: 'text-white/90', soft: 'text-white/70', faint: 'text-white/40', fileLink: 'text-white/70 hover:text-[var(--color-gold)]', attach: 'border-white/15 text-white/80 hover:border-[var(--color-gold)]', fileRow: 'text-white/80', remove: 'text-white/40 hover:text-white/70', textarea: 'border-white/10 bg-white/5 text-white/90 placeholder:text-white/30 focus:border-[var(--color-gold)]' },
  light: { box: 'border-[var(--color-line)] bg-[var(--color-bone)]', head: 'text-[var(--color-stone)]', sub: 'border-[var(--color-line)] bg-[var(--color-porcelain)]', strong: 'text-[var(--color-ink)]', soft: 'text-[var(--color-ink-soft)]', faint: 'text-[var(--color-stone)]', fileLink: 'text-[var(--color-ink-soft)] hover:text-[var(--color-gold)]', attach: 'border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-gold)]', fileRow: 'text-[var(--color-ink-soft)]', remove: 'text-[var(--color-stone)] hover:text-[var(--color-ink)]', textarea: 'border-[var(--color-line)] bg-white text-[var(--color-ink)] placeholder:text-[var(--color-stone)] focus:border-[var(--color-gold)]' },
} as const;

export function HomeworkPanel({ lessonId, submission, tone = 'dark' }: { lessonId: string; submission: HomeworkSubmissionView | null; tone?: 'dark' | 'light' }) {
  const router = useRouter();
  const c = TONES[tone];
  const locked = !!submission && submission.status !== 'NEEDS_REVISION';
  const [files, setFiles] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [pct, setPct] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function addFile(file: File) {
    setUploading(true); setError('');
    try {
      const { upload } = await import('@vercel/blob/client');
      const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, '-').slice(-120) || 'file';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 180_000);
      try {
        const blob = await upload(`academy/homework/${Date.now()}-${safe}`, file, { access: 'public', handleUploadUrl: '/api/academy/homework/blob-token', abortSignal: controller.signal, onUploadProgress: (p) => setPct(Math.round(p.percentage)) });
        setFiles((f) => [...f, blob.url]);
      } finally { clearTimeout(timer); setPct(0); }
    } catch (e) { setError('Upload failed: ' + ((e as Error)?.name === 'AbortError' ? 'timed out' : (e as Error)?.message || 'unknown')); }
    finally { setUploading(false); }
  }

  async function submit() {
    if (files.length === 0) { setError('Attach at least one file.'); return; }
    setBusy(true); setError('');
    const r = await fetch('/api/academy/homework', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonId, files, note }) }).then((x) => x.json()).catch(() => ({ ok: false }));
    if (r.ok) router.refresh();
    else { setBusy(false); setError(r.error || 'Could not submit — please try again.'); }
  }

  return (
    <div className={`mt-6 rounded-[var(--radius-lg)] border p-4 ${c.box}`}>
      <p className={`mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] ${c.head}`}>Homework</p>
      {submission && (
        <div className={`mb-3 rounded-[var(--radius-md)] border p-3 text-sm ${c.sub}`}>
          <p className={`font-medium ${c.strong}`}>{STATUS_LABEL[submission.status] ?? submission.status}</p>
          {submission.files.length > 0 && (
            <ul className="mt-2 space-y-1">{submission.files.map((u) => <li key={u}><a href={u} target="_blank" rel="noreferrer" className={`underline ${c.fileLink}`}>{fileName(u)}</a></li>)}</ul>
          )}
          {submission.feedback && <p className={`mt-2 ${c.soft}`}><span className={c.faint}>Tutor feedback:</span> {submission.feedback}</p>}
        </div>
      )}
      {!locked && (
        <div className="space-y-2">
          {submission?.status === 'NEEDS_REVISION' && <p className="text-sm text-[var(--color-gold)]">Please revise your work and resubmit.</p>}
          {files.length > 0 && (
            <ul className="space-y-1 text-sm">{files.map((u, i) => (
              <li key={u} className={`flex items-center gap-2 ${c.fileRow}`}><span className="flex-1 truncate">{fileName(u)}</span><button onClick={() => setFiles((f) => f.filter((_, j) => j !== i))} className={`shrink-0 ${c.remove}`}>remove</button></li>
            ))}</ul>
          )}
          <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${c.attach} ${uploading ? 'pointer-events-none opacity-60' : ''}`}>
            {uploading ? `Uploading ${pct}%` : '+ Attach file (PDF, Word, image)'}
            <input type="file" accept="application/pdf,.doc,.docx,image/*" className="hidden" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) addFile(file); e.currentTarget.value = ''; }} />
          </label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Add a note for your tutor (optional)…" className={`w-full rounded-[var(--radius-md)] border px-3 py-2 text-sm outline-none ${c.textarea}`} />
          {error && <p role="alert" aria-live="assertive" className="text-sm text-[var(--color-blush-deep)]">{error}</p>}
          <button onClick={submit} disabled={busy || uploading || files.length === 0} className="rounded-full bg-[var(--color-gold)] px-5 py-2 text-sm font-medium text-[var(--color-ink)] disabled:opacity-50">{busy ? 'Submitting…' : submission ? 'Resubmit homework' : 'Submit homework'}</button>
        </div>
      )}
    </div>
  );
}
