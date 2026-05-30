'use client';

/** Re-opens the cookie consent dialog (GDPR right to withdraw/change consent). */
export function CookieSettingsLink() {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event('kc-open-consent'))}
      className="transition-colors hover:text-[var(--color-gold)]"
    >
      Cookie settings
    </button>
  );
}
