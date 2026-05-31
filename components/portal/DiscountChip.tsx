'use client';

import { useState } from 'react';

/** Tappable discount-code chip — copies the code to the clipboard with feedback.
 *  Used in the portal so clients can actually grab their welcome offer. */
export function DiscountChip({ code, copyLabel, copiedLabel }: { code: string; copyLabel: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — chip still shows the code */
    }
  }

  return (
    <button
      onClick={copy}
      title={copyLabel}
      className="group inline-flex items-center gap-2 rounded-full border border-dashed border-[var(--color-gold)] bg-[var(--color-porcelain)] px-3.5 py-1.5 font-[family-name:var(--font-mono)] text-sm font-semibold tracking-wide text-[var(--color-gold)] transition-colors hover:bg-[var(--color-gold)]/10"
    >
      {code}
      {copied ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-jade)]">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {copiedLabel}
        </span>
      ) : (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 opacity-60 transition-opacity group-hover:opacity-100" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
      )}
    </button>
  );
}
