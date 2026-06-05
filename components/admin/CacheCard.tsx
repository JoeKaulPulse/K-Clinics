'use client';

import { useState } from 'react';

// Owner control to purge the site cache on demand. Calls /api/admin/cache, which
// revalidates every page under the root layout — so a price, content or offer
// change shows straight away instead of waiting for the hourly refresh.
export function CacheCard() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function purge() {
    if (!confirm('Refresh the site cache now? Every public page will rebuild on its next visit so the latest prices, content and offers show immediately.')) return;
    setBusy(true); setMsg('Refreshing…');
    try {
      const r = await fetch('/api/admin/cache', { method: 'POST' });
      const j = await r.json().catch(() => ({ ok: false }));
      if (r.ok && j.ok) {
        const at = j.purgedAt ? new Date(j.purgedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
        setMsg(`Cache refreshed ✓${at ? ` at ${at}` : ''} — every page will rebuild on its next visit.`);
      } else {
        setMsg(j.error || 'Could not refresh the cache. Please try again.');
      }
    } catch {
      setMsg('Could not refresh the cache. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <h2 className="font-[family-name:var(--font-display)] text-xl">Site cache</h2>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">
        Public pages are cached for speed and refresh automatically, but if you’ve just changed a price, an offer or page
        content and want it live <em>right now</em>, refresh the cache here. Every page rebuilds on its next visit.
      </p>
      <button
        onClick={purge}
        disabled={busy}
        className="mt-5 rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm text-[var(--color-porcelain)] disabled:opacity-50"
      >
        {busy ? 'Refreshing…' : 'Refresh site cache now'}
      </button>
      {msg && <p className="mt-3 text-sm text-[var(--color-stone)]">{msg}</p>}
    </section>
  );
}
