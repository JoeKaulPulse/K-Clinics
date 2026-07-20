'use client';

import { useState } from 'react';

type Labels = {
  title: string; sub: string; yourLink: string; copy: string; copied: string;
  share: string; shareText: string; stats: string;
  qrShow?: string; qrHide?: string; qrHint?: string;
};

/** Referral panel — shows the client's invite link with copy + native share,
 *  plus a scannable QR of the same link (for sharing in person). */
export function ReferralCard({ link, labels, qrSvg }: { link: string; labels: Labels; qrSvg?: string }) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable — link is still visible */ }
  }

  async function share() {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try { await navigator.share({ title: 'KClinics', text: labels.shareText, url: link }); return; } catch { /* cancelled */ }
    }
    copy();
  }

  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-gold)]/30 bg-gradient-to-br from-[var(--color-gold)]/8 to-transparent p-6">
      <h2 className="font-[family-name:var(--font-display)] text-xl">{labels.title}</h2>
      <p className="mt-1.5 max-w-md text-sm text-[var(--color-stone)]">{labels.sub}</p>

      <label className="mt-5 block text-xs font-medium uppercase tracking-wide text-[var(--color-stone)]">{labels.yourLink}</label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2.5 font-[family-name:var(--font-mono)] text-sm text-[var(--color-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]"
        />
        <button
          onClick={copy}
          className="shrink-0 rounded-full border border-[var(--color-line)] bg-white px-4 py-2.5 text-sm font-medium transition-colors hover:border-[var(--color-gold)] hover:text-[var(--color-gold-deep)]"
        >
          {copied ? `✓ ${labels.copied}` : labels.copy}
        </button>
        {canShare && (
          <button onClick={share} className="shrink-0 rounded-full bg-[var(--color-gold)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-ink)]">
            {labels.share}
          </button>
        )}
      </div>

      {qrSvg && (
        <div className="mt-4">
          <button onClick={() => setShowQr((v) => !v)} className="text-sm font-medium text-[var(--color-gold-deep)] hover:underline">
            {showQr ? (labels.qrHide ?? 'Hide QR code') : (labels.qrShow ?? 'Show QR code')}
          </button>
          {showQr && (
            <div className="mt-3 inline-flex flex-col items-center rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-3">
              {/* eslint-disable-next-line react/no-danger */}
              <div className="h-44 w-44 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              <p className="mt-2 max-w-[11rem] text-center text-xs text-[var(--color-stone)]">{labels.qrHint ?? 'Let a friend scan this to open your invite.'}</p>
            </div>
          )}
        </div>
      )}

      <p className="mt-4 text-xs text-[var(--color-stone)]">{labels.stats}</p>
    </section>
  );
}
