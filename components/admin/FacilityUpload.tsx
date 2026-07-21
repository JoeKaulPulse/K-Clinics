'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

// PRJ-63 — upload a facility document (image or PDF) to the knowledge base.
const TYPES: { value: string; label: string }[] = [
  { value: 'FLOOR_PLAN', label: 'Floor plan' }, { value: 'ELECTRICAL', label: 'Electrical' },
  { value: 'PLUMBING', label: 'Plumbing' }, { value: 'EQUIPMENT', label: 'Equipment' },
  { value: 'INSTRUCTION', label: 'Instruction' }, { value: 'OTHER', label: 'Other' },
];

export function FacilityUpload({ locations }: { locations: { id: string; name: string }[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError(null); setBusy(true);
    try {
      const fd = new FormData(e.currentTarget);
      if (!(fd.get('file') instanceof File) || !(fd.get('file') as File).size) { setError('Choose a file to upload.'); return; }
      const res = await fetch('/api/admin/facility', { method: 'POST', body: fd });
      const j = await res.json().catch(() => ({ ok: false }));
      if (j.ok) { formRef.current?.reset(); setFileName(''); router.refresh(); }
      else setError(j.error || 'Upload failed.');
    } catch { setError('Upload failed.'); }
    finally { setBusy(false); }
  }

  const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]';

  return (
    <form ref={formRef} onSubmit={submit} className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-line)] bg-[var(--color-bone)]/40 p-4">
      <p className="eyebrow mb-3 text-[var(--color-stone)]">Add a document</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="title" placeholder="Title (e.g. Ground floor plan)" aria-label="Title" className={field} maxLength={160} />
        <select name="type" defaultValue="FLOOR_PLAN" className={field}>
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input name="description" placeholder="Description (optional)" aria-label="Description" className={field} maxLength={1000} />
        <select name="locationId" defaultValue="" className={field}>
          <option value="">All locations</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <input name="tags" placeholder="Tags, comma-separated (optional)" aria-label="Tags" className={`${field} sm:col-span-2`} />
        <label className="flex cursor-pointer items-center gap-3 sm:col-span-2">
          <span className="rounded-full border border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 py-2 text-sm hover:bg-[var(--color-bone)]">Choose file</span>
          <span className="truncate text-xs text-[var(--color-stone)]">{fileName || 'Image or PDF · up to 20 MB'}</span>
          <input type="file" name="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setFileName(e.target.files?.[0]?.name || '')} />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="submit" disabled={busy} className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-[var(--color-porcelain)] transition-opacity hover:opacity-90 disabled:opacity-50">
          {busy ? 'Uploading…' : 'Upload'}
        </button>
        {error && <span className="text-xs text-[#b23b3b]">{error}</span>}
      </div>
    </form>
  );
}
