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

export function HomeworkPanel({ lessonId, submission }: { lessonId: string; submission: HomeworkSubmissionView | null }) {
  const router = useRouter();
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
    <div className="mt-6 rounded-[var(--radius-lg)] border border-white/10 bg-white/5 p-4">
      <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-white/40">Homework</p>
      {submission && (
        <div className="mb-3 rounded-[var(--radius-md)] border border-white/10 bg-white/5 p-3 text-sm">
          <p className="font-medium text-white/90">{STATUS_LABEL[submission.status] ?? submission.status}</p>
          {submission.files.length > 0 && (
            <ul className="mt-2 space-y-1">{submission.files.map((u) => <li key={u}><a href={u} target="_blank" rel="noreferrer" className="text-white/70 underline hover:text-[var(--color-gold)]">{fileName(u)}</a></li>)}</ul>
          )}
          {submission.feedback && <p className="mt-2 text-white/70"><span className="text-white/40">Tutor feedback:</span> {submission.feedback}</p>}
        </div>
      )}
      {!locked && (
        <div className="space-y-2">
          {submission?.status === 'NEEDS_REVISION' && <p className="text-sm text-[var(--color-gold)]">Please revise your work and resubmit.</p>}
          {files.length > 0 && (
            <ul className="space-y-1 text-sm">{files.map((u, i) => (
              <li key={u} className="flex items-center gap-2 text-white/80"><span className="flex-1 truncate">{fileName(u)}</span><button onClick={() => setFiles((f) => f.filter((_, j) => j !== i))} className="shrink-0 text-white/40 hover:text-white/70">remove</button></li>
            ))}</ul>
          )}
          <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/80 ${uploading ? 'pointer-events-none opacity-60' : 'hover:border-[var(--color-gold)]'}`}>
            {uploading ? `Uploading ${pct}%` : '+ Attach file (PDF, Word, image)'}
            <input type="file" accept="application/pdf,.doc,.docx,image/*" className="hidden" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) addFile(file); e.currentTarget.value = ''; }} />
          </label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Add a note for your tutor (optional)…" className="w-full rounded-[var(--radius-md)] border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 outline-none placeholder:text-white/30 focus:border-[var(--color-gold)]" />
          {error && <p className="text-sm text-[var(--color-blush)]">{error}</p>}
          <button onClick={submit} disabled={busy || uploading || files.length === 0} className="rounded-full bg-[var(--color-gold)] px-5 py-2 text-sm font-medium text-[var(--color-ink)] disabled:opacity-50">{busy ? 'Submitting…' : submission ? 'Resubmit homework' : 'Submit homework'}</button>
        </div>
      )}
    </div>
  );
}
