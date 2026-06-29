'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// BLD-561: one-click "scan for test/junk records" — tags the obvious inert ones
// so the clients list hides them. Reversible (it only adds a tag); nothing is
// deleted. Shown to staff with clients.edit.
export function ScanTestClientsButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function scan() {
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/admin/clients/scan-test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'scan' }) }).then((res) => res.json());
      if (r.ok) { setMsg(r.tagged ? `Hid ${r.tagged} test record${r.tagged === 1 ? '' : 's'}.` : 'No new test records found.'); router.refresh(); }
      else setMsg(r.error || 'Scan failed.');
    } catch { setMsg('Scan failed.'); } finally { setBusy(false); }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button onClick={scan} disabled={busy}
        className="rounded-full border border-[var(--color-line)] px-3.5 py-1.5 text-sm transition-colors hover:bg-[var(--color-bone)] disabled:opacity-50">
        {busy ? 'Scanning…' : 'Scan for test records'}
      </button>
      {msg && <span className="text-xs text-[var(--color-stone)]">{msg}</span>}
    </span>
  );
}
