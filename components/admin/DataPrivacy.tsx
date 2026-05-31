'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { eraseClientData } from '@/app/admin/actions';

export function DataPrivacy({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState('');
  const [open, setOpen] = useState(false);

  function erase() {
    start(async () => { await eraseClientData(clientId); setOpen(false); setConfirm(''); router.refresh(); });
  }

  return (
    <section>
      <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">Data &amp; privacy</h2>
      <div className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
        <a
          href={`/api/admin/clients/${clientId}/export`}
          className="block rounded-[var(--radius-sm)] bg-[var(--color-ink)] px-4 py-2 text-center text-sm text-[var(--color-porcelain)]"
        >
          Export all data (SAR)
        </a>
        {!open ? (
          <button onClick={() => setOpen(true)} className="block w-full text-center text-xs text-[var(--color-stone)] hover:text-[var(--color-blush)]">
            Erase personal data…
          </button>
        ) : (
          <div className="space-y-2 rounded-[var(--radius-sm)] border border-[var(--color-blush)]/40 bg-[var(--color-blush)]/5 p-3">
            <p className="text-xs text-[var(--color-ink)]">This pseudonymises the client’s personal data (keeping financial records for legal retention) and deletes free-text notes. It can’t be undone. Type <strong>ERASE</strong> to confirm.</p>
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="ERASE" className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-blush)]" />
            <div className="flex gap-2">
              <button onClick={erase} disabled={confirm !== 'ERASE' || pending} className="rounded-full bg-[var(--color-blush)] px-4 py-2 text-xs text-white disabled:opacity-40">{pending ? 'Erasing…' : 'Erase'}</button>
              <button onClick={() => { setOpen(false); setConfirm(''); }} className="px-3 py-2 text-xs text-[var(--color-stone)]">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
