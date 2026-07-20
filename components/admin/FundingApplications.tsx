'use client';

import { useState } from 'react';
import { ROUTE_BY_KEY, type FundingRouteKey } from '@/lib/funding';

export type FundingView = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  route: string;
  courseLevel: string | null;
  eligibleRoutes: string[];
  status: string;
  notes: string | null;
  message: string | null;
  age19Plus: boolean | null;
  residencyOk: boolean | null;
  londonResident: boolean | null;
  islingtonResident: boolean | null;
  employmentStatus: string | null;
  lowIncome: boolean | null;
  priorLevel3: boolean | null;
  courseTitle: string | null;
  createdAt: string;
  enrolmentId: string | null;
  linkedLabel: string | null;
  enrolmentOptions: { id: string; label: string }[];
};

const STATUSES = ['NEW', 'REVIEWING', 'REFERRED', 'APPROVED', 'DECLINED', 'FUNDED', 'CLOSED'] as const;
const STATUS_LABEL: Record<string, string> = {
  NEW: 'New', REVIEWING: 'Reviewing', REFERRED: 'Referred', APPROVED: 'Approved', DECLINED: 'Declined', FUNDED: 'Funded', CLOSED: 'Closed',
};
const routeName = (k: string) => ROUTE_BY_KEY[k as FundingRouteKey]?.name ?? k;
const yn = (v: boolean | null) => (v == null ? '—' : v ? 'Yes' : 'No');
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

async function post(body: object) {
  const res = await fetch('/api/admin/academy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return res.json().catch(() => ({ ok: false }));
}

const field = 'rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-gold)]';

export function FundingApplications({ applications }: { applications: FundingView[] }) {
  const [rows, setRows] = useState(applications);

  async function setStatus(id: string, status: string) {
    setRows((p) => p.map((r) => (r.id === id ? { ...r, status } : r)));
    await post({ op: 'updateFunding', id, status });
  }
  async function saveNotes(id: string, notes: string) {
    await post({ op: 'updateFunding', id, notes });
  }
  async function remove(id: string) {
    if (!confirm('Delete this funding enquiry? This cannot be undone.')) return;
    setRows((p) => p.filter((r) => r.id !== id));
    await post({ op: 'removeFunding', id });
  }
  async function linkEnrolment(id: string, enrolmentId: string, linkedLabel: string | null) {
    setRows((p) => p.map((r) => (r.id === id ? { ...r, enrolmentId: enrolmentId || null, linkedLabel } : r)));
    await post({ op: 'linkFunding', id, enrolmentId });
  }

  if (rows.length === 0) {
    return <p className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 text-center text-sm text-[var(--color-stone)]">No funding enquiries yet. They’ll appear here as students apply through <span className="font-medium text-[var(--color-ink)]">/academy/funding</span>.</p>;
  }

  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <div key={r.id} className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-[family-name:var(--font-display)] text-lg text-[var(--color-ink)]">{r.name}</p>
              <p className="text-sm text-[var(--color-stone)]">
                <a href={`mailto:${r.email}`} className="link-underline">{r.email}</a>
                {r.phone ? <> · <a href={`tel:${r.phone}`} className="link-underline">{r.phone}</a></> : null}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select aria-label="Status" value={r.status} onChange={(e) => setStatus(r.id, e.target.value)} className={field}>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
              <button type="button" onClick={() => remove(r.id)} className="text-sm text-[var(--color-stone)] hover:text-[var(--color-blush-deep)]" aria-label="Delete">Delete</button>
            </div>
          </div>

          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Interested in" value={routeName(r.route)} />
            <Field label="Course level" value={r.courseLevel || r.courseTitle || '—'} />
            <Field label="Routes flagged" value={r.eligibleRoutes.map(routeName).join(', ') || '—'} />
            <Field label="Aged 19+" value={yn(r.age19Plus)} />
            <Field label="Residency 3yr+" value={yn(r.residencyOk)} />
            <Field label="Location" value={r.islingtonResident ? 'Islington' : r.londonResident ? 'London' : '—'} />
            <Field label="Employment" value={r.employmentStatus || '—'} />
            <Field label="Low income / not working" value={yn(r.lowIncome)} />
            <Field label="Holds Level 3" value={yn(r.priorLevel3)} />
          </div>

          {r.message && <p className="mt-3 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-3 text-sm text-[var(--color-ink-soft)]"><span className="text-xs uppercase tracking-wide text-[var(--color-stone)]">Message: </span>{r.message}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-xs uppercase tracking-wide text-[var(--color-stone)]">Linked enrolment</span>
            {r.enrolmentOptions.length === 0 ? (
              <span className="text-xs text-[var(--color-stone)]">No enrolment found for {r.email} — they apply for a course first.</span>
            ) : (
              <select
                aria-label="Link to enrolment"
                value={r.enrolmentId ?? ''}
                onChange={(e) => linkEnrolment(r.id, e.target.value, r.enrolmentOptions.find((o) => o.id === e.target.value)?.label ?? null)}
                className={field}
              >
                <option value="">— not linked —</option>
                {r.enrolmentOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            )}
            {r.linkedLabel && <span className="text-xs text-[var(--color-gold)]">→ {r.linkedLabel}</span>}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <textarea
              defaultValue={r.notes || ''}
              onBlur={(e) => saveNotes(r.id, e.target.value)}
              rows={2}
              placeholder="Staff notes (saved when you click away)…"
              className={`${field} w-full`}
            />
          </div>
          <p className="mt-2 text-xs text-[var(--color-stone)]">Received {fmtDate(r.createdAt)}</p>
        </div>
      ))}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[var(--color-stone)]">{label}</dt>
      <dd className="mt-0.5 text-[var(--color-ink)]">{value}</dd>
    </div>
  );
}
