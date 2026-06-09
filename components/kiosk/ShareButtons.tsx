'use client';

import { useState } from 'react';

type Props = {
  resultId?: string | null; // present in the live flow (lets us count shares)
  shareSlug: string;
  skinScore: number;
  origin?: string;
};

// Social share row. Every share also pings the share API (if we have a resultId)
// to increment the counter. Uses the Web Share API where available.
export function ShareButtons({ resultId, shareSlug, skinScore, origin }: Props) {
  const [copied, setCopied] = useState(false);

  const base = origin || (typeof window !== 'undefined' ? window.location.origin : '');
  const shareUrl = `${base}/kiosk/result/${shareSlug}`;
  const shareText = `I got ${skinScore}/10 on my skin score! Check yours at K Clinics → ${shareUrl}`;

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
    countShare();
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'My K Clinics Skin & Smile Score', text: shareText, url: shareUrl });
      } catch { /* user cancelled */ }
    } else {
      copyLink();
    }
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
      <button onClick={nativeShare} className={`${btn} bg-[var(--color-gold)] text-center text-[var(--color-ink)] hover:opacity-90`}>
        Share to Instagram / more…
      </button>
    </div>
  );
}
