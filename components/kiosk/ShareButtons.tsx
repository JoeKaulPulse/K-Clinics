'use client';

import { useState } from 'react';

type Props = {
  resultId?: string | null; // present in the live flow (lets us count shares)
  shareSlug: string;
  skinScore: number;
  /** v2: the AI's first-person caption — used as the share text when present. */
  shareCaption?: string | null;
  /** Clinic Instagram handle appended to the caption. */
  instagramHandle?: string;
  origin?: string;
};

// Social share row. Every share also pings the share API (if we have a resultId)
// to increment the counter — and a successful native share keeps the SHARED
// claim-gate satisfied. Uses the Web Share API where available; when the device
// can share files, we attach the branded share-card PNG from /results/[id]/card.
export function ShareButtons({ resultId, shareSlug, skinScore, shareCaption, instagramHandle = '@kclinics', origin }: Props) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const base = origin || (typeof window !== 'undefined' ? window.location.origin : '');
  const shareUrl = `${base}/kiosk/result/${shareSlug}`;
  const shareText = shareCaption
    ? `${shareCaption} 📍 K Clinics, Islington London ${instagramHandle} ${shareUrl}`
    : `I got ${skinScore}/10 on my skin score! Check yours at K Clinics → ${shareUrl}`;

  function countShare() {
    if (!resultId) return;
    fetch(`/api/kiosk/results/${resultId}/share`, { method: 'POST' }).catch(() => {});
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      countShare();
    } catch { /* clipboard may be blocked */ }
  }

  async function nativeShare() {
    if (typeof navigator === 'undefined' || !navigator.share) {
      countShare();
      copyLink();
      return;
    }
    if (busy) return;
    setBusy(true);
    // Default payload: text + url. Upgraded to the branded share-card PNG when
    // the device supports file sharing (the url stays inside the text).
    let payload: ShareData = { title: 'My K Clinics Skin & Smile Score', text: shareText, url: shareUrl };
    if (resultId && typeof navigator.canShare === 'function') {
      try {
        const res = await fetch(`/api/kiosk/results/${resultId}/card`);
        if (res.ok) {
          const blob = await res.blob();
          const file = new File([blob], 'kclinics-skin-smile.png', { type: blob.type || 'image/png' });
          if (navigator.canShare({ files: [file], text: shareText })) {
            payload = { files: [file], text: shareText };
          }
        }
      } catch { /* card unavailable — share text + link instead */ }
    }
    try {
      await navigator.share(payload);
      countShare(); // successful share → keeps the SHARED claim-gate
    } catch { /* user cancelled */ }
    finally { setBusy(false); }
  }

  const btn = 'flex-1 rounded-[var(--radius-md)] px-4 py-3 text-sm font-medium transition';

  return (
    <div className="flex flex-col gap-3">
      <button onClick={copyLink} className={`${btn} border border-[var(--color-gold)] text-[var(--color-ink)] hover:bg-[var(--color-bone)]`}>
        {copied ? 'Link copied ✓' : 'Copy link'}
      </button>
      <div className="flex gap-3">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
          target="_blank" rel="noopener noreferrer" onClick={countShare}
          className={`${btn} bg-[#25D366] text-center text-white`}
        >
          WhatsApp
        </a>
        <a
          href={`https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}`}
          target="_blank" rel="noopener noreferrer" onClick={countShare}
          className={`${btn} bg-[var(--color-ink)] text-center text-white`}
        >
          X / Twitter
        </a>
      </div>
      <button onClick={nativeShare} disabled={busy} className={`${btn} bg-[var(--color-gold)] text-center text-[var(--color-ink)] hover:opacity-90 disabled:opacity-60`}>
        {busy ? 'Preparing your card…' : 'Share to Instagram / more…'}
      </button>
    </div>
  );
}
