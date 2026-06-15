'use client';

import { useState } from 'react';

const field = 'mt-1 w-full max-w-xs rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm font-mono';

export function TrackingSettings({ initial, conversions }: { initial: { ga4Id: string; googleAdsId: string; metaPixelId: string }; conversions?: { ga4: boolean; meta: boolean } }) {
  const [ga4Id, setGa4] = useState(initial.ga4Id);
  const [googleAdsId, setAds] = useState(initial.googleAdsId);
  const [metaPixelId, setMeta] = useState(initial.metaPixelId);
  const [ga4ApiSecret, setGa4Secret] = useState('');
  const [metaCapiToken, setMetaToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const dirty = ga4Id !== initial.ga4Id || googleAdsId !== initial.googleAdsId || metaPixelId !== initial.metaPixelId || ga4ApiSecret !== '' || metaCapiToken !== '';

  // What's actually live right now (from the saved config). Lets the owner see at
  // a glance whether each ID "took" — the field can be edited but un-saved, so this
  // reflects the persisted value the public site uses, not the current input.
  const liveStatus: [string, boolean][] = [
    ['Google Analytics 4', !!initial.ga4Id],
    ['Google Ads', !!initial.googleAdsId],
    ['Meta Pixel', !!initial.metaPixelId],
  ];

  async function save() {
    setBusy(true); setMsg('');
    const res = await fetch('/api/admin/tracking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ga4Id, googleAdsId, metaPixelId, ga4ApiSecret, metaCapiToken }) });
    setBusy(false);
    if (res.ok) { setGa4Secret(''); setMetaToken(''); setMsg('Saved ✓ — live within a minute.'); } else setMsg('Save failed.');
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <h2 className="font-[family-name:var(--font-display)] text-lg">Tracking &amp; pixels</h2>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">
        Add your analytics &amp; ad-tracking IDs. These load on the public site <strong>only after a visitor accepts the
        matching cookies</strong> — Analytics for Google Analytics, Marketing for Google Ads &amp; the Meta Pixel — so it stays
        GDPR-compliant. Leave a field blank to disable it.
      </p>

      {/* Live status — what's actually saved & serving on the public site now. */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {liveStatus.map(([label, on]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${on ? 'bg-[var(--color-jade)]' : 'bg-[var(--color-stone-soft)]'}`} />
            {label}: <strong className={on ? 'text-[var(--color-ink)]' : 'text-[var(--color-stone)]'}>{on ? 'Live' : 'Not set'}</strong>
          </span>
        ))}
      </div>
      <p className="mt-3 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bone)]/60 px-3 py-2 text-xs leading-relaxed text-[var(--color-stone)]">
        <strong className="text-[var(--color-ink)]">Testing tip:</strong> these pixels only load after a visitor accepts cookies. To check them, open the public site, click <strong>“Accept all”</strong> on the cookie banner, then look in GA4 DebugView or the Meta Pixel Helper. A checker run <em>without</em> accepting cookies will correctly show nothing — that doesn’t mean the ID isn’t saved.
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
      <div className="mt-5 border-t border-[var(--color-line)] pt-4">
        <h3 className="text-sm font-medium">Server-side conversions <span className="text-xs font-normal text-[var(--color-stone)]">(optional, recommended)</span></h3>
        <p className="mt-1 max-w-2xl text-xs text-[var(--color-stone)]">Send purchases to GA4 &amp; Meta from the server when a booking is charged — accurate, ad-blocker-proof and privacy-safe (email is hashed). Leave blank to keep the current value.</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="text-xs text-[var(--color-stone)]">GA4 API secret {conversions?.ga4 && <span className="text-[var(--color-jade)]">· set ✓</span>}
            <input type="password" value={ga4ApiSecret} onChange={(e) => setGa4Secret(e.target.value)} placeholder={conversions?.ga4 ? '•••••••• (set)' : 'paste secret'} className={field} />
          </label>
          <label className="text-xs text-[var(--color-stone)]">Meta Conversions API token {conversions?.meta && <span className="text-[var(--color-jade)]">· set ✓</span>}
            <input type="password" value={metaCapiToken} onChange={(e) => setMetaToken(e.target.value)} placeholder={conversions?.meta ? '•••••••• (set)' : 'paste token'} className={field} />
          </label>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button onClick={save} disabled={busy || !dirty} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
        {msg && <span className="text-sm text-[var(--color-stone)]">{msg}</span>}
      </div>
    </section>
  );
}
