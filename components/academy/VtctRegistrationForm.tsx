'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Pill, AButton } from '@/components/academy/ui';

// BLD-1794: "VTCT Registration Details" — a trainee's personal details +
// identity documents required for registration with the Academy's awarding
// body. A separate record from the student's general account/profile.

export type DocKind = 'PHOTO_ID' | 'PROOF_OF_ADDRESS' | 'PRIOR_QUALIFICATION';
export type Doc = { id?: string; kind: DocKind; url: string; filename: string };
export type Registration = {
  status: string;
  title: string; firstName: string; middleNames: string | null; lastName: string; dob: string; gender: string; genderSelfDescribe: string | null;
  personalEmail: string; phone: string;
  addressLine1: string; addressLine2: string | null; addressCity: string; addressPostcode: string; addressCountry: string;
  previouslyRegistered: boolean; priorLearnerCode: string | null;
  documents: Doc[];
  submittedAt: string; confirmedAt: string | null; changeRequestedAt: string | null;
};

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null);
const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm';
const label = 'block text-xs font-medium text-[var(--color-stone)]';
const DOC_LABEL: Record<DocKind, string> = { PHOTO_ID: 'Photo ID', PROOF_OF_ADDRESS: 'Proof of address', PRIOR_QUALIFICATION: 'Previous qualification certificate' };

export function VtctRegistrationForm({ initial, titles, genderOptions, declarationText }: {
  initial: Registration | null;
  titles: readonly string[];
  genderOptions: { value: string; label: string }[];
  declarationText: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [firstName, setFirstName] = useState(initial?.firstName ?? '');
  const [middleNames, setMiddleNames] = useState(initial?.middleNames ?? '');
  const [lastName, setLastName] = useState(initial?.lastName ?? '');
  const [dob, setDob] = useState(initial?.dob ?? '');
  const [gender, setGender] = useState(initial?.gender ?? '');
  const [genderSelfDescribe, setGenderSelfDescribe] = useState(initial?.genderSelfDescribe ?? '');
  const [personalEmail, setPersonalEmail] = useState(initial?.personalEmail ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [addressLine1, setAddressLine1] = useState(initial?.addressLine1 ?? '');
  const [addressLine2, setAddressLine2] = useState(initial?.addressLine2 ?? '');
  const [addressCity, setAddressCity] = useState(initial?.addressCity ?? '');
  const [addressPostcode, setAddressPostcode] = useState(initial?.addressPostcode ?? '');
  const [addressCountry, setAddressCountry] = useState(initial?.addressCountry ?? 'United Kingdom');
  const [previouslyRegistered, setPreviouslyRegistered] = useState<boolean | null>(initial ? initial.previouslyRegistered : null);
  const [priorLearnerCode, setPriorLearnerCode] = useState(initial?.priorLearnerCode ?? '');
  const [documents, setDocuments] = useState<Doc[]>(initial?.documents ?? []);
  const [agreed, setAgreed] = useState(false);
  const [uploadingKind, setUploadingKind] = useState<DocKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const photoIdDocs = documents.filter((d) => d.kind === 'PHOTO_ID');
  const proofDocs = documents.filter((d) => d.kind === 'PROOF_OF_ADDRESS');
  const priorDocs = documents.filter((d) => d.kind === 'PRIOR_QUALIFICATION');

  const mandatoryOk = Boolean(
    title && firstName.trim() && lastName.trim() && dob && gender && personalEmail.trim() && phone.trim()
    && addressLine1.trim() && addressCity.trim() && addressPostcode.trim()
    && previouslyRegistered !== null && (!previouslyRegistered || priorLearnerCode.trim())
    && photoIdDocs.length > 0 && proofDocs.length > 0,
  );
  const canSubmit = mandatoryOk && agreed && !busy && !uploadingKind;

  async function addDocument(kind: DocKind, file: File) {
    setUploadingKind(kind); setError(null); setSuccess(false);
    try {
      const { upload } = await import('@vercel/blob/client');
      const safe = (file.name || 'file').replace(/[^A-Za-z0-9._-]+/g, '-').slice(-100);
      // BLD-1794: private store, mirroring the portfolio/homework uploads — the
      // blob URL isn't browser-readable until it's saved and read back through
      // the authenticated document relay.
      const blob = await upload(`vtct/${Date.now()}-${safe}`, file, { access: 'private', handleUploadUrl: '/api/academy/vtct-registration/blob-token' });
      setDocuments((ds) => [...ds, { kind, url: blob.url, filename: file.name || safe }]);
    } catch (e) {
      setError((e as Error)?.message || 'Upload failed. Please try again.');
    }
    setUploadingKind(null);
  }
  const removeDocument = (target: Doc) => setDocuments((ds) => ds.filter((d) => d !== target));

  async function submit() {
    if (!canSubmit) return;
    setBusy(true); setError(null); setSuccess(false);
    const payload = {
      op: 'submit', title, firstName, middleNames, lastName, dob, gender, genderSelfDescribe,
      personalEmail, phone, addressLine1, addressLine2, addressCity, addressPostcode, addressCountry,
      previouslyRegistered, priorLearnerCode,
      documents: documents.map(({ kind, url, filename }) => ({ kind, url, filename })),
      declarationAgreed: true,
    };
    try {
      const res = await fetch('/api/academy/vtct-registration', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) { setError(j.error || 'Could not submit — please check the form and try again.'); setBusy(false); return; }
      setSuccess(true); setAgreed(false);
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    }
    setBusy(false);
  }

  return (
    <div className="space-y-5">
      {initial && <StatusBanner registration={initial} />}
      {success && <p role="status" className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bone)] p-3 text-sm text-[var(--color-ink)]">Your VTCT registration details have been submitted. K Academy will review them and confirm.</p>}

      <Card tone="white" className="p-5">
        <h3 className="font-[family-name:var(--font-display)] text-lg">Personal details</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className={label}>Title *
            <select className={`${field} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)}>
              <option value="">— Select —</option>
              {titles.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className={label}>Date of birth *
            <input type="date" className={`${field} mt-1`} value={dob} onChange={(e) => setDob(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
          </label>
          <label className={label}>First name (legal) *
            <input className={`${field} mt-1`} value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={120} autoComplete="given-name" />
          </label>
          <label className={label}>Middle name(s)
            <input className={`${field} mt-1`} value={middleNames} onChange={(e) => setMiddleNames(e.target.value)} maxLength={160} placeholder="Optional" />
          </label>
          <label className={label}>Last name / surname (legal) *
            <input className={`${field} mt-1`} value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={120} autoComplete="family-name" />
          </label>
          <label className={label}>Gender *
            <select className={`${field} mt-1`} value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">— Select —</option>
              {genderOptions.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </label>
          {gender === 'OTHER' && (
            <label className={label}>Please self-describe
              <input className={`${field} mt-1`} value={genderSelfDescribe} onChange={(e) => setGenderSelfDescribe(e.target.value)} maxLength={120} />
            </label>
          )}
          <label className={label}>Personal email *
            <input type="email" className={`${field} mt-1`} value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} maxLength={200} autoComplete="email" />
          </label>
          <label className={label}>Phone number *
            <input type="tel" className={`${field} mt-1`} value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} autoComplete="tel" />
          </label>
        </div>

        <h4 className="mt-5 text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">Residential address (full current address) *</h4>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className={`${label} sm:col-span-2`}>Address line 1 *
            <input className={`${field} mt-1`} value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} maxLength={200} autoComplete="address-line1" />
          </label>
          <label className={`${label} sm:col-span-2`}>Address line 2
            <input className={`${field} mt-1`} value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} maxLength={200} autoComplete="address-line2" placeholder="Optional" />
          </label>
          <label className={label}>Town / city *
            <input className={`${field} mt-1`} value={addressCity} onChange={(e) => setAddressCity(e.target.value)} maxLength={120} autoComplete="address-level2" />
          </label>
          <label className={label}>Postcode *
            <input className={`${field} mt-1`} value={addressPostcode} onChange={(e) => setAddressPostcode(e.target.value)} maxLength={20} autoComplete="postal-code" />
          </label>
          <label className={label}>Country
            <input className={`${field} mt-1`} value={addressCountry} onChange={(e) => setAddressCountry(e.target.value)} maxLength={80} autoComplete="country-name" />
          </label>
        </div>
      </Card>

      <Card tone="white" className="p-5">
        <h3 className="font-[family-name:var(--font-display)] text-lg">Previous VTCT Skills registration</h3>
        <p className={`${label} mt-1`}>Have you previously completed or been registered for any VTCT Skills qualifications? *</p>
        <div className="mt-2 flex gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="radio" name="prevReg" checked={previouslyRegistered === true} onChange={() => setPreviouslyRegistered(true)} /> Yes</label>
          <label className="flex items-center gap-2"><input type="radio" name="prevReg" checked={previouslyRegistered === false} onChange={() => { setPreviouslyRegistered(false); setPriorLearnerCode(''); }} /> No</label>
        </div>
        {previouslyRegistered === true && (
          <label className={`${label} mt-3 block max-w-sm`}>Existing VTCT Skills learner code / registration number *
            <input className={`${field} mt-1`} value={priorLearnerCode} onChange={(e) => setPriorLearnerCode(e.target.value)} maxLength={80} />
          </label>
        )}
      </Card>

      <Card tone="white" className="p-5">
        <h3 className="font-[family-name:var(--font-display)] text-lg">Supporting documents</h3>
        <p className="mt-1 text-sm text-[var(--color-stone)]">Uploaded documents are stored securely and are only ever visible to you and K Academy staff.</p>
        <div className="mt-4 space-y-4">
          <DocGroup kind="PHOTO_ID" required hint="Passport, driving licence, or other photo ID." docs={photoIdDocs} uploading={uploadingKind === 'PHOTO_ID'} onAdd={(f) => addDocument('PHOTO_ID', f)} onRemove={removeDocument} />
          <DocGroup kind="PROOF_OF_ADDRESS" required hint="A recent utility bill, bank statement, or council tax letter." docs={proofDocs} uploading={uploadingKind === 'PROOF_OF_ADDRESS'} onAdd={(f) => addDocument('PROOF_OF_ADDRESS', f)} onRemove={removeDocument} />
          {previouslyRegistered === true && (
            <DocGroup kind="PRIOR_QUALIFICATION" hint="Optional — certificate(s) for the qualification(s) above. You can add more than one." multiple docs={priorDocs} uploading={uploadingKind === 'PRIOR_QUALIFICATION'} onAdd={(f) => addDocument('PRIOR_QUALIFICATION', f)} onRemove={removeDocument} />
          )}
        </div>
      </Card>

      <Card tone="bone" className="p-5">
        <h3 className="font-[family-name:var(--font-display)] text-lg">Student Declaration, Accuracy of Information and Responsibility</h3>
        <p className="mt-3 whitespace-pre-line text-sm text-[var(--color-ink-soft)]">{declarationText}</p>
        <label className="mt-4 flex items-start gap-2.5 text-sm text-[var(--color-ink)]">
          <input type="checkbox" className="mt-0.5 shrink-0" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>I have read the declaration above and I agree to it.</span>
        </label>
      </Card>

      {error && <p role="alert" aria-live="assertive" className="text-sm text-[var(--color-blush-deep)]">{error}</p>}
      {!mandatoryOk && <p className="text-xs text-[var(--color-stone)]">Complete every required field (*) and upload Photo ID and Proof of Address to enable submission.</p>}

      <div>
        <AButton onClick={submit} disabled={!canSubmit}>{busy ? 'Submitting…' : 'Submit VTCT Registration Details'}</AButton>
      </div>
    </div>
  );
}

function StatusBanner({ registration: r }: { registration: Registration }) {
  if (r.status === 'CONFIRMED') {
    return (
      <Card accent tone="porcelain" className="flex flex-wrap items-center gap-3 p-4">
        <Pill tone="good">Confirmed</Pill>
        <p className="text-sm text-[var(--color-ink-soft)]">K Academy confirmed your registration details{r.confirmedAt ? ` on ${fmt(r.confirmedAt)}` : ''}. If anything changes (address, name, phone), edit and resubmit below — this flags your change for the Academy to review again rather than overwriting the confirmed record.</p>
      </Card>
    );
  }
  if (r.status === 'CHANGES_PENDING') {
    return (
      <Card accent tone="porcelain" className="flex flex-wrap items-center gap-3 p-4">
        <Pill tone="gold">Changes pending review</Pill>
        <p className="text-sm text-[var(--color-ink-soft)]">You changed details after K Academy confirmed your registration. Your previously confirmed details are kept on file until the Academy reviews and re-confirms your changes.</p>
      </Card>
    );
  }
  return (
    <Card tone="porcelain" className="flex flex-wrap items-center gap-3 p-4">
      <Pill tone="info">Submitted</Pill>
      <p className="text-sm text-[var(--color-ink-soft)]">Submitted on {fmt(r.submittedAt)} — awaiting review by K Academy.</p>
    </Card>
  );
}

function DocGroup({ kind, docs, required, multiple, hint, uploading, onAdd, onRemove }: {
  kind: DocKind; docs: Doc[]; required?: boolean; multiple?: boolean; hint: string; uploading: boolean;
  onAdd: (f: File) => void; onRemove: (d: Doc) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-3">
      <p className="text-sm font-medium text-[var(--color-ink)]">{DOC_LABEL[kind]}{required && ' *'}</p>
      <p className="text-xs text-[var(--color-stone)]">{hint}</p>
      {docs.length > 0 && (
        <ul className="mt-2 space-y-1">
          {docs.map((d, i) => (
            <li key={`${d.url}-${i}`} className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] bg-[var(--color-bone)] px-2.5 py-1.5 text-xs">
              {d.id ? <a href={d.url} target="_blank" rel="noopener noreferrer" className="truncate text-[var(--color-gold-deep)] hover:underline">{d.filename}</a> : <span className="truncate text-[var(--color-ink)]">{d.filename} (uploaded)</span>}
              <button type="button" onClick={() => onRemove(d)} className="shrink-0 text-[var(--color-blush-deep)] hover:underline">Remove</button>
            </li>
          ))}
        </ul>
      )}
      {(multiple || docs.length === 0) && (
        <div className="mt-2">
          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) onAdd(f); e.currentTarget.value = ''; }} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs hover:border-[var(--color-gold)] disabled:opacity-50">{uploading ? 'Uploading…' : `+ Add ${DOC_LABEL[kind].toLowerCase()}`}</button>
        </div>
      )}
    </div>
  );
}
