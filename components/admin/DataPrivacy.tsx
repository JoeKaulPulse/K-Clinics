'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { eraseClientData, deleteClient } from '@/app/admin/actions';

export function DataPrivacy({ clientId, canDelete = false }: { clientId: string; canDelete?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState('');
  const [open, setOpen] = useState(false);

  // Permanent delete state
  const [delOpen, setDelOpen] = useState(false);
  const [delConfirm, setDelConfirm] = useState('');
  const [delErr, setDelErr] = useState('');
  const [deleting, startDelete] = useTransition();

  const exportHref = `/api/admin/clients/${clientId}/export`;

  function erase() {
    start(async () => { await eraseClientData(clientId); setOpen(false); setConfirm(''); router.refresh(); });
  }

  function destroy() {
    setDelErr('');
    startDelete(async () => {
      const res = await deleteClient(clientId, delConfirm);
      if (res?.ok) router.push('/admin/clients');
      else setDelErr(res?.error || 'Could not delete this client.');
    });
  }

  return (
    <section>
      <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">Data &amp; privacy</h2>
      <div className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
        <a
          href={exportHref}
          className="block rounded-[var(--radius-sm)] bg-[var(--color-ink)] px-4 py-2 text-center text-sm text-[var(--color-porcelain)]"
        >
          Export all data (SAR)
        </a>
        <p className="text-[0.7rem] leading-relaxed text-[var(--color-stone)]">
          Downloads a complete JSON of this client’s record — for a Subject Access Request or legally-required retention before deletion.
        </p>

        {/* Pseudonymise (keeps financial records) */}
        {!open ? (
          <button onClick={() => setOpen(true)} className="block w-full text-center text-xs text-[var(--color-stone)] hover:text-[var(--color-blush-deep)]">
            Erase personal data (keep financial records)…
          </button>
        ) : (
          <div className="space-y-2 rounded-[var(--radius-sm)] border border-[var(--color-blush)]/40 bg-[var(--color-blush)]/5 p-3">
            <p className="text-xs text-[var(--color-ink)]">This pseudonymises the client’s personal data (keeping financial records for legal retention) and deletes free-text notes. It can’t be undone. Type <strong>ERASE</strong> to confirm.</p>
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="ERASE" aria-label="Type ERASE to confirm" className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-blush)]" />
            <div className="flex gap-2">
              <button onClick={erase} disabled={confirm !== 'ERASE' || pending} className="rounded-full bg-[var(--color-blush)] px-4 py-2 text-xs text-white disabled:opacity-40">{pending ? 'Erasing…' : 'Erase'}</button>
              <button onClick={() => { setOpen(false); setConfirm(''); }} className="px-3 py-2 text-xs text-[var(--color-stone)]">Cancel</button>
            </div>
          </div>
        )}

        {/* Permanent hard delete — owners/admins only */}
        {canDelete && (
          <div className="mt-1 border-t border-[var(--color-line)] pt-3">
            {!delOpen ? (
              <button onClick={() => setDelOpen(true)} className="block w-full text-center text-xs font-medium text-[var(--color-blush-deep)] hover:underline">
                Delete client permanently…
              </button>
            ) : (
              <div className="space-y-2.5 rounded-[var(--radius-sm)] border border-[var(--color-blush)] bg-[var(--color-blush)]/8 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-blush-deep)]">Danger zone</p>
                <p className="text-xs leading-relaxed text-[var(--color-ink)]">
                  This <strong>permanently deletes</strong> the client and <strong>all</strong> related records — bookings, health forms, points, reviews and history. It <strong>cannot be undone</strong>.
                </p>
                <a href={exportHref} className="block rounded-[var(--radius-sm)] border border-[var(--color-ink)] px-3 py-1.5 text-center text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-bone)]">
                  ↓ Download all data first (SAR / retention)
                </a>
                <p className="text-xs text-[var(--color-ink)]">Type <strong>DELETE</strong> (capitals) to confirm.</p>
                <input
                  value={delConfirm}
                  onChange={(e) => { setDelConfirm(e.target.value); setDelErr(''); }}
                  placeholder="DELETE"
                  aria-label="Type DELETE to confirm"
                  autoComplete="off"
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-blush)]/60 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-blush)]"
                />
                {delErr && <p className="text-xs text-[var(--color-blush-deep)]">{delErr}</p>}
                <div className="flex gap-2">
                  <button onClick={destroy} disabled={delConfirm !== 'DELETE' || deleting} className="rounded-full bg-[var(--color-blush)] px-4 py-2 text-xs font-medium text-white disabled:opacity-40">{deleting ? 'Deleting…' : 'Delete permanently'}</button>
                  <button onClick={() => { setDelOpen(false); setDelConfirm(''); setDelErr(''); }} className="px-3 py-2 text-xs text-[var(--color-stone)]">Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
