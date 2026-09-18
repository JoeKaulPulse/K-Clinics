'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
// Type-only import: lib/incidents.ts is `server-only`, so nothing from it may
// be imported for its runtime value here.
import type { IncidentRegisterRow } from '@/lib/incidents';

// PRJ-1229.4 — clinic-wide incidents register. Filtering is client-side over
// the set the server already fetched (capped at INCIDENT_REGISTER_LIMIT by
// lib/incidents.ts) — mirrors the filter pattern in components/admin/BuildBoard.tsx
// rather than round-tripping to the API on every change. `total` is the true
// count ignoring that cap: when it exceeds the rows we have, say so, because a
// safety register that silently stops at a round number reads as complete when
// it is not.
//
// Blank detail on a row has two meanings and they are shown differently —
// deliberately redacted on client erasure (record intact) vs. failed to decrypt
// (record NOT intact). See the IncidentRegisterRow type.

const CATEGORY_LABEL: Record<string, string> = {
  slip_trip: 'Slip / trip / fall',
  adverse_reaction: 'Adverse reaction',
  equipment: 'Equipment / device',
  other: 'Other',
};
const SEVERITY_LABEL: Record<string, string> = { minor: 'Minor', moderate: 'Moderate', serious: 'Serious' };
const SEVERITY_BADGE: Record<string, string> = {
  minor: 'bg-[var(--color-bone)] text-[var(--color-stone)]',
  moderate: 'bg-[var(--color-gold)]/20 text-[var(--color-ink)]',
  serious: 'bg-[var(--color-blush)]/20 text-[var(--color-blush-deep)]',
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const field = 'rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm';

export function IncidentRegister({ rows, total }: { rows: IncidentRegisterRow[]; total: number }) {
  const [severity, setSeverity] = useState<string>('all');
  const [riddorOnly, setRiddorOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(
    () => rows.filter((r) => (severity === 'all' || r.severity === severity) && (!riddorOnly || r.riddorReportable)),
    [rows, severity, riddorOnly],
  );

  const riddorCount = useMemo(() => rows.filter((r) => r.riddorReportable).length, [rows]);
  const erasedCount = useMemo(() => rows.filter((r) => !r.clientId).length, [rows]);
  const undecryptable = useMemo(() => rows.filter((r) => r.decryptFailed).length, [rows]);
  const truncated = total > rows.length;

  return (
    <div className="mt-7">
      <div className="grid gap-4 sm:grid-cols-3">
        {/* The headline count is the TRUE total, not the number of rows loaded —
            the two differ once the register is capped, and understating the
            incident count on a safety register is the wrong way round. */}
        <Stat label="Total incidents" value={total} tone="stone" />
        <Stat label="RIDDOR-reportable" value={riddorCount} tone={riddorCount ? 'red' : 'stone'} />
        <Stat label="Erasure-retained" value={erasedCount} tone="gold" />
      </div>

      {truncated && (
        <p className="mt-4 rounded-[var(--radius-sm)] bg-[var(--color-gold)]/15 px-4 py-2.5 text-sm text-[var(--color-ink)]">
          Showing the {rows.length} most recent of {total} incidents. The counts for RIDDOR-reportable and
          erasure-retained records above cover only the {rows.length} loaded, so treat this as a recent view rather
          than the full register.
        </p>
      )}

      {undecryptable > 0 && (
        <p className="mt-4 rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-4 py-2.5 text-sm text-[var(--color-ink)]">
          {undecryptable} record{undecryptable === 1 ? '' : 's'} could not be decrypted and {undecryptable === 1 ? 'is' : 'are'} shown
          without detail. This is not the same as a record redacted on erasure — please raise it, the clinical
          encryption key may be wrong or rotated.
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-[var(--color-stone)]">
          Severity
          <select className={field} value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="all">All</option>
            <option value="minor">Minor</option>
            <option value="moderate">Moderate</option>
            <option value="serious">Serious</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--color-stone)]">
          <input
            type="checkbox"
            checked={riddorOnly}
            onChange={(e) => setRiddorOnly(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-gold)]"
          />
          RIDDOR-reportable only
        </label>
        <span className="text-xs text-[var(--color-stone)]">
          Showing {filtered.length} of {rows.length}
        </span>
      </div>

      <div className="mt-6 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-[var(--color-stone)]">
            {rows.length === 0 ? 'No incidents logged yet.' : 'No incidents match these filters.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-left text-xs uppercase tracking-wide text-[var(--color-stone)]">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">RIDDOR</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Logged by</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <IncidentRow key={r.id} r={r} open={openId === r.id} onToggle={() => setOpenId(openId === r.id ? null : r.id)} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function IncidentRow({ r, open, onToggle }: { r: IncidentRegisterRow; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr
        className="cursor-pointer border-b border-[var(--color-line)] align-top last:border-0 hover:bg-[var(--color-bone)]"
        onClick={onToggle}
      >
        <td className="px-4 py-3 tabular-nums">{fmtDate(r.createdAt)}</td>
        <td className="px-4 py-3 text-[var(--color-ink)]">{CATEGORY_LABEL[r.category] || r.category}</td>
        <td className="px-4 py-3">
          <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${SEVERITY_BADGE[r.severity] || 'bg-[var(--color-bone)] text-[var(--color-stone)]'}`}>
            {SEVERITY_LABEL[r.severity] || r.severity}
          </span>
        </td>
        <td className="px-4 py-3">
          {r.riddorReportable ? (
            <span className="inline-block rounded-full bg-[var(--color-blush-deep)] px-2.5 py-1 text-xs font-medium text-white">RIDDOR</span>
          ) : (
            <span className="text-xs text-[var(--color-stone)]">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-[var(--color-stone)]">{r.location || '—'}</td>
        <td className="px-4 py-3">
          {r.clientId ? (
            <Link
              href={`/admin/clients/${r.clientId}`}
              onClick={(e) => e.stopPropagation()}
              className="font-medium text-[var(--color-gold-deep)] hover:underline"
            >
              {r.clientName || 'View client'}
            </Link>
          ) : (
            <span className="text-xs italic text-[var(--color-stone)]">Erased client — record retained</span>
          )}
        </td>
        <td className="px-4 py-3 text-[var(--color-stone)]">{r.loggedBy || '—'}</td>
      </tr>
      {open && (
        <tr className="border-b border-[var(--color-line)] bg-[var(--color-bone)] last:border-0">
          <td colSpan={7} className="px-4 py-4">
            {r.decryptFailed ? (
              <p className="rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-3 py-2 text-sm text-[var(--color-ink)]">
                This record&rsquo;s detail could not be decrypted, so it is not shown. The record itself is intact —
                the clinical encryption key may be wrong or rotated. Please raise it rather than treating the
                incident as having no detail.
              </p>
            ) : r.redacted ? (
              <p className="rounded-[var(--radius-sm)] bg-[var(--color-bone)] px-3 py-2 text-sm text-[var(--color-stone)]">
                Detail was redacted when the client was{' '}
                {r.redacted === 'client-deleted' ? 'deleted' : 'erased'}. The safety facts above (date, category,
                severity, RIDDOR status) are retained under UK GDPR Art. 17(3)(b); the narrative was removed on
                purpose and is not recoverable.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail label="What happened" value={r.description} />
                <Detail label="Injury" value={r.injury} />
                <Detail label="Action taken" value={r.actionTaken} />
                <Detail label="Witnesses" value={r.witnesses} />
              </div>
            )}
            {r.bookingId && <p className="mt-2 text-xs text-[var(--color-stone)]">Linked appointment: {r.bookingId}</p>}
          </td>
        </tr>
      )}
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-[var(--color-stone)]">{label}</p>
      <p className="mt-1 text-sm text-[var(--color-ink)]">{value || '—'}</p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'red' | 'gold' | 'stone' }) {
  const color =
    tone === 'red' ? 'text-[var(--color-blush-deep)]' : tone === 'gold' ? 'text-[var(--color-gold-deep)]' : 'text-[var(--color-stone)]';
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">{label}</p>
      <p className={`mt-2 font-[family-name:var(--font-display)] text-3xl tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
