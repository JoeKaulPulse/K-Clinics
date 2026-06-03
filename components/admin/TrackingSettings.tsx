'use client';

import { useState } from 'react';

const field = 'mt-1 w-full max-w-xs rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm font-mono';

export function TrackingSettings({ initial }: { initial: { ga4Id: string; googleAdsId: string; metaPixelId: string } }) {
  const [ga4Id, setGa4] = useState(initial.ga4Id);
  const [googleAdsId, setAds] = useState(initial.googleAdsId);
  const [metaPixelId, setMeta] = useState(initial.metaPixelId);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const dirty = ga4Id !== initial.ga4Id || googleAdsId !== initial.googleAdsId || metaPixelId !== initial.metaPixelId;

  async function save() {
    setBusy(true); setMsg('');
    const res = await fetch('/api/admin/tracking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ga4Id, googleAdsId, metaPixelId }) });
    setBusy(false);
    setMsg(res.ok ? 'Saved ✓ — live within a minute.' : 'Save failed.');
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <h2 className="font-[family-name:var(--font-display)] text-lg">Tracking &amp; pixels</h2>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">
        Add your analytics &amp; ad-tracking IDs. These load on the public site <strong>only after a visitor accepts the
        matching cookies</strong> — Analytics for Google Analytics, Marketing for Google Ads &amp; the Meta Pixel — so it stays
        GDPR-compliant. Leave a field blank to disable it.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="text-xs text-[var(--color-stone)]">Google Analytics 4 ID
          <input value={ga4Id} onChange={(e) => setGa4(e.target.value)} placeholder="G-XXXXXXXXXX" className={field} />
        </label>
        <label className="text-xs text-[var(--color-stone)]">Google Ads conversion ID
          <input value={googleAdsId} onChange={(e) => setAds(e.target.value)} placeholder="AW-XXXXXXXXX" className={field} />
        </label>
        <label className="text-xs text-[var(--color-stone)]">Meta (Facebook) Pixel ID
          <input value={metaPixelId} onChange={(e) => setMeta(e.target.value)} placeholder="1234567890" className={field} />
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button onClick={save} disabled={busy || !dirty} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
        {msg && <span className="text-sm text-[var(--color-stone)]">{msg}</span>}
      </div>
    </section>
  );
}
