'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// BLD-1794: staff queue of every trainee's VTCT Registration Details submission.
export type ReviewRegistration = {
  id: string; studentId: string; studentName: string; studentEmail: string; status: string;
  title: string; firstName: string; middleNames: string | null; lastName: string; dob: string; gender: string; genderSelfDescribe: string | null;
  personalEmail: string; phone: string;
  addressLine1: string; addressLine2: string | null; addressCity: string; addressPostcode: string; addressCountry: string;
  previouslyRegistered: boolean; priorLearnerCode: string | null;
  documents: { id: string; kind: string; filename: string; url: string }[];
  declarationAgreedAt: string;
  submittedAt: string; confirmedAt: string | null; confirmedBy: string | null; changeRequestedAt: string | null;
};

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const DOC_LABEL: Record<string, string> = { PHOTO_ID: 'Photo ID', PROOF_OF_ADDRESS: 'Proof of address', PRIOR_QUALIFICATION: 'Previous qualification certificate' };
const badge = (s: string) => s === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-800' : s === 'CHANGES_PENDING' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800';

export function VtctRegistrationReview({ registrations, statusLabels }: { registrations: ReviewRegistration[]; statusLabels: Record<string, string> }) {
  const router = useRouter();
  const pending = registrations.filter((r) => r.status !== 'CONFIRMED').length;
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-stone)]">{pending} awaiting review · {registrations.length} total</p>
      {registrations.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] p-6 text-center text-sm text-[var(--color-stone)]">No VTCT registrations submitted yet. Trainees submit these from the portal&apos;s VTCT Registration tab.</p>
      ) : registrations.map((r) => <Row key={r.id} r={r} statusLabels={statusLabels} onChanged={() => router.refresh()} />)}
    </div>
  );
}

function Row({ r, statusLabels, onChanged }: { r: ReviewRegistration; statusLabels: Record<string, string>; onChanged: () => void }) {
  const [open, setOpen] = useState(r.status !== 'CONFIRMED');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true); setError(null);
    const res = await fetch('/api/admin/academy/vtct-registration', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'confirm', id: r.id }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !j.ok) { setError(j.error || 'Could not confirm. Try again.'); return; }
    onChanged();
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
      <div className="flex flex-wrap items-center gap-2 p-3">
        <button onClick={() => setOpen((v) => !v)} className="text-[var(--color-stone)]">{open ? '▾' : '▸'}</button>
        <span className="flex-1 text-sm">
          <Link href={`/admin/academy/students/${r.studentId}`} className="font-medium text-[var(--color-ink)] hover:text-[var(--color-gold-deep)] hover:underline">{r.studentName}</Link>
          <span className="text-[var(--color-stone)]"> · {r.title} {r.firstName} {r.lastName} · submitted {fmt(r.submittedAt)}</span>
        </span>
        <span className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide ${badge(r.status)}`}>{statusLabels[r.status] ?? r.status}</span>
      </div>
      {open && (
        <div className="space-y-3 border-t border-[var(--color-line)] p-3 text-sm">
          {r.status === 'CHANGES_PENDING' && (
            <p className="rounded-[var(--radius-sm)] border border-[var(--color-gold)]/40 bg-[var(--color-gold)]/5 p-2.5 text-xs text-[var(--color-ink-soft)]">Changed since it was last confirmed{r.confirmedAt ? ` on ${fmt(r.confirmedAt)}` : ''} — review the details below before re-confirming.</p>
          )}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <div><dt className="uppercase tracking-wide text-[var(--color-stone)]">Trainee account</dt><dd>{r.studentEmail}</dd></div>
            <div><dt className="uppercase tracking-wide text-[var(--color-stone)]">Date of birth</dt><dd>{fmt(r.dob)}</dd></div>
            <div><dt className="uppercase tracking-wide text-[var(--color-stone)]">Legal name</dt><dd>{r.title} {r.firstName} {r.middleNames ? `${r.middleNames} ` : ''}{r.lastName}</dd></div>
            <div><dt className="uppercase tracking-wide text-[var(--color-stone)]">Gender</dt><dd>{r.gender.replace(/_/g, ' ').toLowerCase()}{r.genderSelfDescribe ? ` (${r.genderSelfDescribe})` : ''}</dd></div>
            <div><dt className="uppercase tracking-wide text-[var(--color-stone)]">Personal email</dt><dd className="break-all">{r.personalEmail}</dd></div>
            <div><dt className="uppercase tracking-wide text-[var(--color-stone)]">Phone</dt><dd>{r.phone}</dd></div>
            <div className="col-span-2"><dt className="uppercase tracking-wide text-[var(--color-stone)]">Address</dt><dd>{r.addressLine1}{r.addressLine2 ? `, ${r.addressLine2}` : ''}, {r.addressCity}, {r.addressPostcode}, {r.addressCountry}</dd></div>
            <div className="col-span-2"><dt className="uppercase tracking-wide text-[var(--color-stone)]">Previously VTCT-registered?</dt><dd>{r.previouslyRegistered ? `Yes — learner code ${r.priorLearnerCode || '—'}` : 'No'}</dd></div>
          </dl>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">Documents</p>
            {r.documents.length === 0 ? <p className="mt-1 text-xs text-[var(--color-stone)]">None.</p> : (
              <ul className="mt-1 space-y-1">
                {r.documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] bg-[var(--color-bone)] px-2.5 py-1.5 text-xs">
                    <span className="truncate"><span className="text-[var(--color-stone)]">{DOC_LABEL[d.kind] ?? d.kind}:</span> {d.filename}</span>
                    <a href={d.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[var(--color-gold-deep)] hover:underline">View / download →</a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {r.status !== 'CONFIRMED' && (
            <div className="flex items-center gap-2">
              <button onClick={confirm} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-xs font-medium text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Confirming…' : 'Confirm registration details'}</button>
              {error && <span role="alert" className="text-xs text-[var(--color-blush-deep)]">{error}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
