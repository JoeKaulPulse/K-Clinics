'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// BLD-534: tutor review of trainee portfolio case studies.
export type Photo = { url: string; caption?: string; kind: 'before' | 'after' | 'other' };
export type ReviewEntry = {
  id: string; title: string; treatmentType: string; treatmentDate: string | null; clientRef: string | null;
  notes: string; photos: Photo[]; status: string; feedback: string | null; consentAttestedAt: string | null; courseTitle: string | null;
  studentName: string; studentEmail: string; createdAt: string; updatedAt: string; reviewedBy: string | null; reviewedAt: string | null;
  clientLinked: boolean; clientEmail: string | null; // BLD-1291
};

const dateFmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const badge = (s: string) => s === 'APPROVED' ? 'bg-[var(--color-sage,#3f6f4f)]/15 text-[var(--color-sage,#3f6f4f)]' : s === 'SUBMITTED' ? 'bg-[var(--color-gold)]/15 text-[var(--color-gold-deep)]' : s === 'NEEDS_WORK' ? 'bg-[var(--color-blush)]/15 text-[var(--color-blush-deep)]' : 'bg-[var(--color-line)] text-[var(--color-stone)]';

export function PortfolioReview({ entries, statusLabels }: { entries: ReviewEntry[]; statusLabels: Record<string, string> }) {
  const router = useRouter();
  const submitted = entries.filter((e) => e.status === 'SUBMITTED').length;
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-stone)]">{submitted} awaiting review · {entries.length} total</p>
      {entries.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] p-6 text-center text-sm text-[var(--color-stone)]">No portfolio case studies yet. Trainees build these from the portal’s Portfolio tab.</p>
      ) : entries.map((e) => <EntryRow key={e.id} entry={e} statusLabels={statusLabels} onChanged={() => router.refresh()} />)}
    </div>
  );
}

// BLD-1291: the free-text "Client ref" keeps cases anonymised for trainees, but
// the photos are real, identifying clinical images — without a link to the CRM
// client they are invisible to right-to-erasure and subject-access exports.
// Staff paste the client's email here once; the server resolves and audit-logs.
function ClientLink({ entry: e, onChanged }: { entry: ReviewEntry; onChanged: () => void }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(clientEmail: string) {
    setBusy(true); setError(null);
    const res = await fetch('/api/admin/portfolio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'linkClient', id: e.id, clientEmail }) });
    const r = await res.json().catch(() => ({ ok: false, error: 'Request failed.' }));
    setBusy(false);
    if (r.ok) { setEmail(''); onChanged(); } else setError(r.error || 'Could not link.');
  }

  if (e.clientLinked) {
    return (
      <p className="text-xs text-[var(--color-stone)]">
        Photographed client: <span className="text-[var(--color-ink)]">{e.clientEmail || 'linked'}</span> — photos covered by erasure/SAR.{' '}
        <button onClick={() => act('')} disabled={busy} className="text-[var(--color-gold-deep)] underline-offset-2 hover:underline disabled:opacity-40">Unlink</button>
        {error && <span role="alert" className="ml-2 text-[var(--color-blush-deep)]">{error}</span>}
      </p>
    );
  }
  return (
    <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--color-line)] p-2.5">
      <p className="text-xs text-[var(--color-blush-deep)]">Not linked to a client record — these photos won’t be found by an erasure or data-access request.</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <input value={email} onChange={(ev) => setEmail(ev.target.value)} type="email" placeholder="Client’s email in the CRM" aria-label="Photographed client's email" className="w-64 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-xs" />
        <button onClick={() => email.trim() && act(email)} disabled={busy || !email.trim()} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs hover:border-[var(--color-gold)] disabled:opacity-40">{busy ? 'Linking…' : 'Link client'}</button>
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-[var(--color-blush-deep)]">{error}</p>}
    </div>
  );
}

function EntryRow({ entry: e, statusLabels, onChanged }: { entry: ReviewEntry; statusLabels: Record<string, string>; onChanged: () => void }) {
  const [open, setOpen] = useState(e.status === 'SUBMITTED');
  const [feedback, setFeedback] = useState(e.feedback ?? '');
  const [busy, setBusy] = useState(false);

  async function review(status: 'APPROVED' | 'NEEDS_WORK') {
    if (status === 'NEEDS_WORK' && !feedback.trim()) { alert('Add feedback so the trainee knows what to change.'); return; }
    setBusy(true);
    await fetch('/api/admin/portfolio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'review', id: e.id, status, feedback }) });
    setBusy(false); onChanged();
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white">
      <div className="flex flex-wrap items-center gap-2 p-3">
        <button onClick={() => setOpen((v) => !v)} className="text-[var(--color-stone)]">{open ? '▾' : '▸'}</button>
        <span className="flex-1 text-sm">
          <span className="font-medium text-[var(--color-ink)]">{e.title}</span>
          <span className="text-[var(--color-stone)]"> · {e.studentName} · {e.treatmentType}{e.courseTitle ? ` · ${e.courseTitle}` : ''}</span>
        </span>
        <span className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide ${badge(e.status)}`}>{statusLabels[e.status] ?? e.status}</span>
      </div>
      {open && (
        <div className="space-y-3 border-t border-[var(--color-line)] p-3">
          <div className="grid gap-1 text-xs text-[var(--color-stone)] sm:grid-cols-2">
            <span>Trainee: <span className="text-[var(--color-ink)]">{e.studentName}</span> ({e.studentEmail})</span>
            <span>Treatment date: <span className="text-[var(--color-ink)]">{dateFmt(e.treatmentDate)}</span></span>
            <span>Client ref: <span className="text-[var(--color-ink)]">{e.clientRef || '—'}</span></span>
            <span>Last updated: <span className="text-[var(--color-ink)]">{dateFmt(e.updatedAt)}</span></span>
            {/* BLD-740: subject-consent attestation — legacy photo entries show "not recorded" until the trainee next edits. */}
            {e.photos.length > 0 && (
              <span>Subject consent: {e.consentAttestedAt ? <span className="text-[var(--color-ink)]">attested {dateFmt(e.consentAttestedAt)}</span> : <span className="text-[var(--color-blush-deep)]">not recorded</span>}</span>
            )}
          </div>

          {e.notes && <p className="whitespace-pre-line rounded-[var(--radius-sm)] bg-[var(--color-bone)] p-3 text-sm text-[var(--color-ink-soft)]">{e.notes}</p>}

          {e.photos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {e.photos.map((p, i) => (
                <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.caption || p.kind} className="h-24 w-24 rounded-[var(--radius-sm)] border border-[var(--color-line)] object-cover" />
                  <span className="mt-0.5 block text-center text-[0.65rem] uppercase tracking-wide text-[var(--color-stone)]">{p.kind}</span>
                </a>
              ))}
            </div>
          )}

          {e.reviewedBy && <p className="text-xs text-[var(--color-stone)]">Last reviewed by {e.reviewedBy} on {dateFmt(e.reviewedAt)}.</p>}

          {/* BLD-1291: link the case to the photographed client's CRM record so
              the photos are covered by erasure and subject-access requests. */}
          {e.photos.length > 0 && <ClientLink entry={e} onChanged={onChanged} />}

          <div>
            <textarea value={feedback} onChange={(ev) => setFeedback(ev.target.value)} rows={2} placeholder="Feedback for the trainee (required to request changes)…" aria-label="Feedback for trainee" className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm" />
            <div className="mt-2 flex flex-wrap gap-2">
              <button onClick={() => review('APPROVED')} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-xs font-medium text-[var(--color-porcelain)] disabled:opacity-50">Approve</button>
              <button onClick={() => review('NEEDS_WORK')} disabled={busy} className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-xs hover:border-[var(--color-gold)] disabled:opacity-50">Request changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
