'use client';

import { useState } from 'react';

// One-click runner for the owner-gated clinical-encryption backfill
// (/api/admin/maintenance/backfill-clinical-encryption). Historic rows written
// before at-rest encryption (audit/06 C3) stay plaintext until this runs once;
// it's idempotent, so re-running is always safe and all-zeros means "done".
const FIELD_LABELS: Record<string, string> = {
  'client.medicalFlag': 'Medical flags',
  'client.allergies': 'Client allergies',
  'consultation.concerns': 'Consultation concerns',
  'consultation.message': 'Consultation messages',
  'consultation.medicalNotes': 'Consultation medical notes',
  'booking.allergyNote': 'Booking allergy notes',
};

export function ClinicalEncryptionBackfill() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/maintenance/backfill-clinical-encryption', { method: 'POST' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error || 'Something went wrong — please try again.');
      } else {
        setResult(json.encrypted as Record<string, number>);
      }
    } catch {
      setError('Could not reach the server — check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  const total = result ? Object.values(result).reduce((a, b) => a + b, 0) : null;

  return (
    <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
      <div className="flex items-center gap-3 border-b border-[var(--color-line)] px-5 py-3.5">
        <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-bone)] text-[var(--color-gold-deep)]">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
        </span>
        <h2 className="font-[family-name:var(--font-display)] text-lg">Data protection</h2>
      </div>

      <div className="px-5 py-4">
        <p className="text-sm text-[var(--color-stone)]">
          New medical details (allergies, medical flags, consultation notes) are always saved encrypted.
          Records saved <em>before</em> encryption was switched on need a one-time upgrade. This button does
          that — it is safe to press more than once.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={run}
            disabled={busy}
            className="rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm font-medium text-[var(--color-porcelain)] transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none"
          >
            {busy ? 'Encrypting…' : 'Encrypt historic clinical data'}
          </button>
          {result && total === 0 && (
            <span className="inline-flex items-center gap-2 rounded-full bg-[color-mix(in_oklab,var(--color-jade)_14%,transparent)] px-3.5 py-1.5 text-sm font-medium text-[var(--color-jade)]">
              <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6.2 4.8 9 10 3.4" /></svg>
              All clinical data is encrypted — nothing left to upgrade.
            </span>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-[#b23b3b]">{error}</p>}

        {result && total !== null && total > 0 && (
          <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)]/50 px-4 py-3">
            <p className="text-sm font-medium">Upgraded {total} record{total === 1 ? '' : 's'} to encrypted storage:</p>
            <ul className="mt-1.5 space-y-0.5 text-sm text-[var(--color-stone)]">
              {Object.entries(result).filter(([, n]) => n > 0).map(([k, n]) => (
                <li key={k}>{FIELD_LABELS[k] ?? k} — {n}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-[var(--color-stone-soft)]">Press the button once more — when it reports nothing left to upgrade, every historic record is encrypted.</p>
          </div>
        )}
      </div>
    </section>
  );
}
