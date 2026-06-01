'use client';

import { useState } from 'react';

type Labels = {
  title: string; sub: string; yourLink: string; copy: string; copied: string;
  share: string; shareText: string; stats: string;
};

/** Referral panel — shows the client's invite link with copy + native share. */
export function ReferralCard({ link, labels }: { link: string; labels: Labels }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable — link is still visible */ }
  }

  async function share() {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try { await navigator.share({ title: 'K Clinics', text: labels.shareText, url: link }); return; } catch { /* cancelled */ }
    }
    copy();
  }

  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-gold)]/30 bg-gradient-to-br from-[var(--color-gold)]/8 to-transparent p-6">
      <h2 className="font-[family-name:var(--font-display)] text-xl">{labels.title}</h2>
      <p className="mt-1.5 max-w-md text-sm text-[var(--color-stone)]">{labels.sub}</p>

      <label className="mt-5 block text-xs font-medium uppercase tracking-wide text-[var(--color-stone-soft)]">{labels.yourLink}</label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2.5 font-[family-name:var(--font-mono)] text-sm text-[var(--color-ink)] outline-none"
        />
        <button
          onClick={copy}
          className="shrink-0 rounded-full border border-[var(--color-line)] bg-white px-4 py-2.5 text-sm font-medium transition-colors hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
        >
          {copied ? `✓ ${labels.copied}` : labels.copy}
        </button>
        {canShare && (
          <button onClick={share} className="shrink-0 rounded-full bg-[var(--color-gold)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-ink)]">
            {labels.share}
          </button>
        )}
      </div>

      <p className="mt-4 text-xs text-[var(--color-stone-soft)]">{labels.stats}</p>
    </section>
  );
}
