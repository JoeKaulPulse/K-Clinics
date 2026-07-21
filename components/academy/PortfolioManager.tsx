'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Pill, AButton, EmptyState } from '@/components/academy/ui';

// BLD-534: trainee portfolio — case studies with before/after photos + tutor review.
export type Photo = { url: string; caption?: string; kind: 'before' | 'after' | 'other' };
// A just-uploaded photo's blob URL is PRIVATE (BLD-740) — the browser can't
// render it directly, so we carry a local object-URL preview until it's saved
// (the server strips unknown fields; saved photos come back as relay URLs).
type EditPhoto = Photo & { preview?: string };
export type Entry = {
  id: string; title: string; treatmentType: string; treatmentDate: string | null; clientRef: string | null;
  notes: string; photos: Photo[]; status: string; feedback: string | null; consentAttestedAt: string | null;
  courseId: string | null; courseTitle: string | null;
  createdAt: string; updatedAt: string; reviewedAt: string | null;
};
type Course = { id: string; title: string };

const statusTone = (s: string): 'neutral' | 'info' | 'good' | 'gold' => s === 'APPROVED' ? 'good' : s === 'SUBMITTED' ? 'info' : s === 'NEEDS_WORK' ? 'gold' : 'neutral';
const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm';
const dateFmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null);

export function PortfolioManager({ entries, courses, treatmentSuggestions, statusLabels }: { entries: Entry[]; courses: Course[]; treatmentSuggestions: string[]; statusLabels: Record<string, string> }) {
  const [editing, setEditing] = useState<Entry | 'new' | null>(null);
  const router = useRouter();

  if (editing) {
    return <Editor entry={editing === 'new' ? null : editing} courses={courses} treatmentSuggestions={treatmentSuggestions} onClose={() => { setEditing(null); router.refresh(); }} />;
  }

  const approved = entries.filter((e) => e.status === 'APPROVED').length;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <AButton onClick={() => setEditing('new')}>+ Add case study</AButton>
        {entries.length > 0 && <span className="text-sm text-[var(--color-stone)]">{entries.length} case{entries.length === 1 ? '' : 's'} · {approved} approved</span>}
      </div>

      {entries.length === 0 ? (
        <EmptyState title="Start your portfolio" action={<AButton onClick={() => setEditing('new')}>Add your first case</AButton>}>
          Log the practical cases you complete — treatment, anonymised client, before/after photos and your notes. Submit each for your tutor to review and approve. Keep all client details anonymous.
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {entries.map((e) => (
            <li key={e.id}>
              <Card tone="white" className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-[family-name:var(--font-display)] text-lg leading-snug">{e.title}</h3>
                  <Pill tone={statusTone(e.status)}>{statusLabels[e.status] ?? e.status}</Pill>
                </div>
                <p className="mt-1 text-sm text-[var(--color-stone)]">{e.treatmentType}{e.treatmentDate ? ` · ${dateFmt(e.treatmentDate)}` : ''}{e.courseTitle ? ` · ${e.courseTitle}` : ''}</p>
                {e.photos.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {e.photos.slice(0, 4).map((p, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={p.url} alt={p.caption || p.kind} className="h-14 w-14 rounded-[var(--radius-sm)] border border-[var(--color-line)] object-cover" />
                    ))}
                    {e.photos.length > 4 && <span className="grid h-14 w-14 place-items-center rounded-[var(--radius-sm)] border border-[var(--color-line)] text-xs text-[var(--color-stone)]">+{e.photos.length - 4}</span>}
                  </div>
                )}
                {e.status === 'NEEDS_WORK' && e.feedback && (
                  <p className="mt-3 rounded-[var(--radius-sm)] border border-[var(--color-gold)]/40 bg-[var(--color-gold)]/5 p-2.5 text-xs text-[var(--color-ink-soft)]"><strong>Tutor:</strong> {e.feedback}</p>
                )}
                {e.status === 'APPROVED' && e.feedback && (
                  <p className="mt-3 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bone)] p-2.5 text-xs text-[var(--color-ink-soft)]"><strong>Tutor:</strong> {e.feedback}</p>
                )}
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  {e.status !== 'APPROVED' && <AButton size="sm" variant="secondary" onClick={() => setEditing(e)}>Edit</AButton>}
                  {e.status === 'APPROVED' && <AButton size="sm" variant="secondary" onClick={() => setEditing(e)}>View</AButton>}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Editor({ entry, courses, treatmentSuggestions, onClose }: { entry: Entry | null; courses: Course[]; treatmentSuggestions: string[]; onClose: () => void }) {
  const readOnly = entry?.status === 'APPROVED';
  const [title, setTitle] = useState(entry?.title ?? '');
  const [treatmentType, setTreatmentType] = useState(entry?.treatmentType ?? '');
  const [treatmentDate, setTreatmentDate] = useState(entry?.treatmentDate ? entry.treatmentDate.slice(0, 10) : '');
  const [clientRef, setClientRef] = useState(entry?.clientRef ?? '');
  const [courseId, setCourseId] = useState(entry?.courseId ?? '');
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const [photos, setPhotos] = useState<EditPhoto[]>(entry?.photos ?? []);
  const [consented, setConsented] = useState(!!entry?.consentAttestedAt);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function addPhoto(file: File) {
    setUploading(true); setPct(0); setError(null);
    try {
      const { upload } = await import('@vercel/blob/client');
      const safe = (file.name || 'photo').replace(/[^A-Za-z0-9._-]+/g, '-').slice(-100);
      // BLD-740: private store — the blob URL isn't browser-readable, so keep a
      // local object-URL preview; once saved it renders via the photo relay.
      const blob = await upload(`portfolio/${Date.now()}-${safe}`, file, { access: 'private', handleUploadUrl: '/api/academy/portfolio/blob-token', onUploadProgress: (p) => setPct(Math.round(p.percentage)) });
      setPhotos((ps) => [...ps, { url: blob.url, kind: 'before', preview: URL.createObjectURL(file) }]);
    } catch (e) { setError((e as Error)?.message || 'Upload failed.'); }
    setUploading(false);
  }
  const setPhoto = (i: number, patch: Partial<Photo>) => setPhotos((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const removePhoto = (i: number) => setPhotos((ps) => ps.filter((_, j) => j !== i));

  async function save(submit: boolean) {
    if (photos.length > 0 && !consented) { setError('Please tick the consent confirmation below the photos before saving.'); return; }
    setBusy(true); setError(null);
    const payload = { title, treatmentType, treatmentDate, clientRef, courseId, notes, photos: photos.map(({ preview: _preview, ...p }) => p), consentPhotos: consented };
    try {
      const op = entry ? 'update' : 'create';
      const r = await fetch('/api/academy/portfolio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op, id: entry?.id, ...payload }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) { setError(j.error || 'Could not save. Try again.'); setBusy(false); return; }
      if (submit) {
        const id = entry?.id ?? j.id;
        const sr = await fetch('/api/academy/portfolio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'submit', id }) });
        const sj = await sr.json().catch(() => ({}));
        if (!sr.ok || !sj.ok) { setError(sj.error || 'Saved, but could not submit.'); setBusy(false); return; }
      }
      onClose();
    } catch { setError('Network error. Try again.'); setBusy(false); }
  }

  async function del() {
    if (!entry || !confirm('Delete this case study? This cannot be undone.')) return;
    setBusy(true);
    await fetch('/api/academy/portfolio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'delete', id: entry.id }) });
    onClose();
  }

  return (
    <div className="space-y-4">
      <button onClick={onClose} className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">← Back to portfolio</button>
      <Card tone="white">
        {readOnly && <p className="mb-3 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bone)] p-2.5 text-xs text-[var(--color-stone)]">This case has been approved and is now read-only.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-[var(--color-stone)] sm:col-span-2">Case title
            <input className={`${field} mt-1`} value={title} disabled={readOnly} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Anti-wrinkle treatment — upper face" maxLength={160} />
          </label>
          <label className="text-xs font-medium text-[var(--color-stone)]">Treatment type
            <input className={`${field} mt-1`} list="treatment-types" value={treatmentType} disabled={readOnly} onChange={(e) => setTreatmentType(e.target.value)} maxLength={80} />
            <datalist id="treatment-types">{treatmentSuggestions.map((t) => <option key={t} value={t} />)}</datalist>
          </label>
          <label className="text-xs font-medium text-[var(--color-stone)]">Treatment date
            <input type="date" className={`${field} mt-1`} value={treatmentDate} disabled={readOnly} onChange={(e) => setTreatmentDate(e.target.value)} />
          </label>
          <label className="text-xs font-medium text-[var(--color-stone)]">Client reference (anonymous)
            <input className={`${field} mt-1`} value={clientRef} disabled={readOnly} onChange={(e) => setClientRef(e.target.value)} placeholder="e.g. Client A" maxLength={80} />
          </label>
          {courses.length > 0 && (
            <label className="text-xs font-medium text-[var(--color-stone)]">Course (optional)
              <select className={`${field} mt-1`} value={courseId} disabled={readOnly} onChange={(e) => setCourseId(e.target.value)}>
                <option value="">— None —</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </label>
          )}
        </div>

        <label className="mt-3 block text-xs font-medium text-[var(--color-stone)]">Notes / method
          <textarea className={`${field} mt-1`} rows={5} value={notes} disabled={readOnly} onChange={(e) => setNotes(e.target.value)} placeholder="Product, dose/units, technique, aftercare, outcome and any complications. Keep the client anonymous." maxLength={8000} />
        </label>

        {/* Photos */}
        <div className="mt-4">
          <p className="text-xs font-medium text-[var(--color-stone)]">Photos (before / after)</p>
          {photos.length > 0 && (
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {photos.map((p, i) => (
                <li key={i} className="flex gap-2 rounded-[var(--radius-sm)] border border-[var(--color-line)] p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.preview || p.url} alt={p.caption || p.kind} className="h-16 w-16 shrink-0 rounded-[var(--radius-sm)] object-cover" />
                  <div className="flex-1 space-y-1">
                    <select className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-1 text-xs" value={p.kind} disabled={readOnly} onChange={(e) => setPhoto(i, { kind: e.target.value as Photo['kind'] })}>
                      <option value="before">Before</option><option value="after">After</option><option value="other">Other</option>
                    </select>
                    <input className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-1 text-xs" value={p.caption ?? ''} disabled={readOnly} onChange={(e) => setPhoto(i, { caption: e.target.value })} placeholder="Caption (optional)" maxLength={200} />
                    {!readOnly && <button onClick={() => removePhoto(i)} className="text-xs text-[var(--color-blush-deep)] hover:underline">Remove</button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {!readOnly && (
            <div className="mt-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) addPhoto(f); e.currentTarget.value = ''; }} />
              <AButton size="sm" variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? `Uploading ${pct}%` : '+ Add photo'}</AButton>
            </div>
          )}
          {/* BLD-740: required subject-consent attestation for any entry with photos. */}
          {photos.length > 0 && (
            <label className="mt-3 flex items-start gap-2 text-xs text-[var(--color-ink-soft)]">
              <input type="checkbox" className="mt-0.5 shrink-0" checked={consented} disabled={readOnly} onChange={(e) => setConsented(e.target.checked)} />
              <span>I confirm the person in these photos consented to them being stored and reviewed for my portfolio.</span>
            </label>
          )}
        </div>

        {error && <p role="alert" aria-live="assertive" className="mt-3 text-sm text-[var(--color-blush-deep)]">{error}</p>}

        {!readOnly && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <AButton onClick={() => save(false)} disabled={busy || uploading} variant="secondary" size="sm">{busy ? 'Saving…' : 'Save draft'}</AButton>
            <AButton onClick={() => save(true)} disabled={busy || uploading} size="sm">{busy ? 'Saving…' : 'Save & submit for review'}</AButton>
            {entry && <button onClick={del} disabled={busy} className="ml-auto text-xs text-[var(--color-blush-deep)] hover:underline disabled:opacity-40">Delete case</button>}
          </div>
        )}
      </Card>
    </div>
  );
}
