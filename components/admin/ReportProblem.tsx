'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';

// Floating "Report a problem" button available across the admin. Staff log an
// issue with a screenshot, detail and urgency; it lands on the Build & Issues
// board (routed to Claude by default).
const TYPES: { v: string; label: string }[] = [
  { v: 'ERROR', label: 'Something’s broken' },
  { v: 'TASK', label: 'A change / task' },
  { v: 'IDEA', label: 'An idea' },
];
const URG: { v: string; label: string }[] = [
  { v: 'P0', label: 'P0 · Critical (blocking)' },
  { v: 'P1', label: 'P1 · High' },
  { v: 'P2', label: 'P2 · Normal' },
  { v: 'P3', label: 'P3 · Low' },
];

export function ReportProblem() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('ERROR');
  const [urgency, setUrgency] = useState('P2');
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [shots, setShots] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    for (const f of Array.from(files).slice(0, 6 - shots.length)) {
      const fd = new FormData(); fd.append('file', f);
      const r = await fetch('/api/admin/build/upload', { method: 'POST', body: fd }).then((x) => x.json()).catch(() => ({ ok: false }));
      if (r.ok) setShots((s) => [...s, r.url]); else setError(r.error || 'Upload failed.');
    }
    setUploading(false);
  }

  async function submit() {
    if (!title.trim()) { setError('Add a short title.'); return; }
    setStatus('saving'); setError('');
    const r = await fetch('/api/admin/build', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'create', type, urgency, title, detail, screenshots: shots, pageUrl: pathname }),
    }).then((x) => x.json()).catch(() => ({ ok: false }));
    if (r.ok) {
      setStatus('done');
      setTimeout(() => { setOpen(false); setStatus('idle'); setTitle(''); setDetail(''); setShots([]); setType('ERROR'); setUrgency('P2'); }, 1400);
    } else { setError(r.error || 'Could not submit.'); setStatus('error'); }
  }

  // The full-screen messages view has its own bottom-right composer; this floating
  // button would overlap its send button (esp. on mobile), so hide it there.
  if (pathname.startsWith('/admin/messages')) return null;

  return (
    <>
      {/* Sit above the shared GuideHost "?" launcher (also fixed bottom-5 right-5):
          stacking them vertically stops the round help button from overlapping
          and clipping this pill's label to "Report a prob…". */}
      <button onClick={() => setOpen(true)} className="fixed bottom-20 right-5 z-40 rounded-full bg-[var(--color-ink)] px-4 py-2.5 text-sm font-medium text-[var(--color-porcelain)] shadow-[var(--shadow-lift)] hover:bg-[var(--color-gold-deep)]">⚑ Report a problem</button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[rgba(42,36,32,0.5)] p-4" onClick={() => setOpen(false)}>
          <div className="my-8 w-full max-w-lg rounded-[var(--radius-lg)] bg-[var(--color-porcelain)] p-6 shadow-[var(--shadow-lift)]" onClick={(e) => e.stopPropagation()}>
            {status === 'done' ? (
              <div className="py-8 text-center">
                <p className="font-[family-name:var(--font-display)] text-2xl">Thank you — logged.</p>
                <p className="mt-1 text-sm text-[var(--color-stone)]">It’s on the build board and routed to Claude.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between"><h2 className="font-[family-name:var(--font-display)] text-xl">Report a problem</h2><button onClick={() => setOpen(false)} aria-label="Close" className="text-sm text-[var(--color-stone)]"><span aria-hidden="true">✕</span></button></div>
                <p className="mt-1 text-xs text-[var(--color-stone)]">On <span className="font-mono">{pathname}</span>. Add a screenshot and as much detail as you can.</p>

                <div className="mt-4 flex gap-3">
                  <label className="flex-1 text-xs text-[var(--color-stone)]">Type<br /><select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-2 text-sm">{TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select></label>
                  <label className="flex-1 text-xs text-[var(--color-stone)]">Urgency<br /><select value={urgency} onChange={(e) => setUrgency(e.target.value)} className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-2 text-sm">{URG.map((u) => <option key={u.v} value={u.v}>{u.label}</option>)}</select></label>
                </div>

                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short title — e.g. ‘Pricing page total is wrong’" className="mt-3 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" />
                <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={4} placeholder="What happened, what you expected, steps to reproduce…" className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" />

                <div className="mt-3">
                  <label className="inline-block cursor-pointer rounded-full border border-[var(--color-line)] px-4 py-1.5 text-xs hover:bg-[var(--color-bone)]">
                    {uploading ? 'Uploading…' : '📎 Add screenshot'}
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
                  </label>
                  {shots.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{shots.map((s) => <img key={s} src={s} alt="" className="h-16 w-auto rounded border border-[var(--color-line)]" />)}</div>}
                </div>

                {error && <p className="mt-3 text-sm text-[var(--color-blush)]">{error}</p>}
                <div className="mt-4 flex justify-end gap-2">
                  <button onClick={() => setOpen(false)} className="rounded-full px-4 py-2 text-sm text-[var(--color-stone)]">Cancel</button>
                  <button onClick={submit} disabled={status === 'saving'} className="rounded-full bg-[var(--color-gold)] px-6 py-2 text-sm font-medium text-white disabled:opacity-50">{status === 'saving' ? 'Sending…' : 'Send to Claude'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
