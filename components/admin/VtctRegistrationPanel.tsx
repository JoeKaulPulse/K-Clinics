'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// BLD-1794: staff view of one trainee's VTCT Registration Details — shown on
// the academy admin student profile. Read-only (the trainee owns the data via
// the portal form); the one action staff have is confirming the submission.
export type AdminDoc = { id: string; kind: string; filename: string; url: string; uploadedAt: string };
export type AdminRegistration = {
  id: string; status: string;
  title: string; firstName: string; middleNames: string | null; lastName: string; dob: string; gender: string; genderSelfDescribe: string | null;
  personalEmail: string; phone: string;
  addressLine1: string; addressLine2: string | null; addressCity: string; addressPostcode: string; addressCountry: string;
  previouslyRegistered: boolean; priorLearnerCode: string | null;
  documents: AdminDoc[];
  declarationAgreedAt: string;
  submittedAt: string; confirmedAt: string | null; confirmedBy: string | null; changeRequestedAt: string | null;
};

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const fmtDT = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const DOC_LABEL: Record<string, string> = { PHOTO_ID: 'Photo ID', PROOF_OF_ADDRESS: 'Proof of address', PRIOR_QUALIFICATION: 'Previous qualification certificate' };
const STATUS_TONE: Record<string, string> = { CONFIRMED: 'bg-emerald-100 text-emerald-800', CHANGES_PENDING: 'bg-amber-100 text-amber-800', SUBMITTED: 'bg-sky-100 text-sky-800' };
const STATUS_LABEL: Record<string, string> = { CONFIRMED: 'Confirmed', CHANGES_PENDING: 'Changes pending review', SUBMITTED: 'Submitted — awaiting review' };

export function VtctRegistrationPanel({ registration }: { registration: AdminRegistration | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!registration) {
    return <p className="text-sm text-[var(--color-stone)]">Not submitted yet. The trainee completes this from their portal (Academy &rarr; VTCT Registration).</p>;
  }
  const r = registration;

  async function confirm() {
    setBusy(true); setError(null);
    const res = await fetch('/api/admin/academy/vtct-registration', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'confirm', id: r.id }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !j.ok) { setError(j.error || 'Could not confirm. Try again.'); return; }
    router.refresh();
  }

  const byKind = (kind: string) => r.documents.filter((d) => d.kind === kind);

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide ${STATUS_TONE[r.status] ?? 'bg-[var(--color-line)] text-[var(--color-stone)]'}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
        <span className="text-xs text-[var(--color-stone)]">Submitted {fmt(r.submittedAt)}{r.confirmedAt ? ` · confirmed ${fmt(r.confirmedAt)}${r.confirmedBy ? ` by ${r.confirmedBy}` : ''}` : ''}</span>
      </div>

      {r.status === 'CHANGES_PENDING' && (
        <p className="rounded-[var(--radius-sm)] border border-[var(--color-gold)]/40 bg-[var(--color-gold)]/5 p-2.5 text-xs text-[var(--color-ink-soft)]">The trainee changed these details after a previous confirmation ({fmt(r.changeRequestedAt)}). Check the details and documents below, then confirm again.</p>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div><dt className="uppercase tracking-wide text-[var(--color-stone)]">Legal name</dt><dd>{r.title} {r.firstName} {r.middleNames ? `${r.middleNames} ` : ''}{r.lastName}</dd></div>
        <div><dt className="uppercase tracking-wide text-[var(--color-stone)]">Date of birth</dt><dd>{fmt(r.dob)}</dd></div>
        <div><dt className="uppercase tracking-wide text-[var(--color-stone)]">Gender</dt><dd>{r.gender.replace(/_/g, ' ').toLowerCase()}{r.genderSelfDescribe ? ` (${r.genderSelfDescribe})` : ''}</dd></div>
        <div><dt className="uppercase tracking-wide text-[var(--color-stone)]">Personal email</dt><dd className="break-all">{r.personalEmail}</dd></div>
        <div><dt className="uppercase tracking-wide text-[var(--color-stone)]">Phone</dt><dd>{r.phone}</dd></div>
        <div className="col-span-2"><dt className="uppercase tracking-wide text-[var(--color-stone)]">Address</dt><dd>{r.addressLine1}{r.addressLine2 ? `, ${r.addressLine2}` : ''}, {r.addressCity}, {r.addressPostcode}, {r.addressCountry}</dd></div>
        <div className="col-span-2"><dt className="uppercase tracking-wide text-[var(--color-stone)]">Previously VTCT-registered?</dt><dd>{r.previouslyRegistered ? `Yes — learner code ${r.priorLearnerCode || '—'}` : 'No'}</dd></div>
        <div className="col-span-2"><dt className="uppercase tracking-wide text-[var(--color-stone)]">Declaration agreed</dt><dd>{fmtDT(r.declarationAgreedAt)}</dd></div>
      </dl>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">Documents</p>
        {r.documents.length === 0 ? <p className="mt-1 text-xs text-[var(--color-stone)]">None.</p> : (
          <ul className="mt-1 space-y-1">
            {(['PHOTO_ID', 'PROOF_OF_ADDRESS', 'PRIOR_QUALIFICATION'] as const).flatMap((kind) => byKind(kind).map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] bg-[var(--color-bone)] px-2.5 py-1.5 text-xs">
                <span className="truncate"><span className="text-[var(--color-stone)]">{DOC_LABEL[kind] ?? kind}:</span> {d.filename}</span>
                <a href={d.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[var(--color-gold-deep)] hover:underline">View / download &rarr;</a>
              </li>
            )))}
          </ul>
        )}
      </div>

      {r.status !== 'CONFIRMED' && (
        <div className="flex items-center gap-2 pt-1">
          <button onClick={confirm} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-xs font-medium text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Confirming…' : 'Confirm registration details'}</button>
          {error && <span role="alert" className="text-xs text-[var(--color-blush-deep)]">{error}</span>}
        </div>
      )}
    </div>
  );
}
