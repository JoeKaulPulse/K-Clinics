'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';

// UK GDPR / PECR-compliant cookie consent. Non-essential cookies (analytics,
// marketing) are OFF until the visitor actively opts in — no pre-ticked boxes,
// and "Reject" is as easy as "Accept". The choice is stored in localStorage and
// broadcast via a `kc-consent` event so analytics can load only after consent.

export type ConsentValue = { necessary: true; analytics: boolean; marketing: boolean; ts: number };
const KEY = 'kc_cookie_consent_v1';

export function getConsent(): ConsentValue | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ConsentValue) : null;
  } catch {
    return null;
  }
}

function save(v: ConsentValue) {
  localStorage.setItem(KEY, JSON.stringify(v));
  window.dispatchEvent(new CustomEvent('kc-consent', { detail: v }));
}

export function CookieConsent() {
  const [show, setShow] = useState(false);
  const [customise, setCustomise] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    if (!getConsent()) setShow(true);
    // Allow re-opening from a footer "Cookie settings" link.
    const open = () => { setCustomise(true); setShow(true); };
    window.addEventListener('kc-open-consent', open);
    return () => window.removeEventListener('kc-open-consent', open);
  }, []);

  function decide(a: boolean, m: boolean) {
    save({ necessary: true, analytics: a, marketing: m, ts: Date.now() });
    setShow(false);
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          role="dialog"
          aria-label="Cookie consent"
          className="fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-2xl rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5 shadow-[var(--shadow-lift)] md:inset-x-auto md:left-6 md:bottom-6 md:p-6"
        >
          <p className="font-[family-name:var(--font-display)] text-lg">Your privacy, your choice</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-stone)]">
            We use essential cookies to make our site work. With your consent, we’d also like to use analytics and
            marketing cookies to improve your experience. You can change your mind anytime. See our{' '}
            <Link href="/info/privacy-policy" className="underline">Privacy Policy</Link>.
          </p>

          {customise && (
            <div className="mt-4 space-y-2 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)] p-4 text-sm">
              <Row label="Strictly necessary" desc="Required for the site to function. Always on." checked disabled />
              <Row label="Analytics" desc="Helps us understand how the site is used." checked={analytics} onChange={setAnalytics} />
              <Row label="Marketing" desc="Used to personalise offers and measure campaigns." checked={marketing} onChange={setMarketing} />
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2.5">
            <button onClick={() => decide(true, true)} className="rounded-full bg-[var(--color-gold)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-ink)]">
              Accept all
            </button>
            <button onClick={() => decide(false, false)} className="rounded-full border border-[var(--color-line)] px-5 py-2.5 text-sm font-medium hover:bg-[var(--color-bone)]">
              Reject non-essential
            </button>
            {customise ? (
              <button onClick={() => decide(analytics, marketing)} className="rounded-full border border-[var(--color-line)] px-5 py-2.5 text-sm font-medium hover:bg-[var(--color-bone)]">
                Save choices
              </button>
            ) : (
              <button onClick={() => setCustomise(true)} className="rounded-full px-5 py-2.5 text-sm font-medium text-[var(--color-stone)] hover:text-[var(--color-ink)]">
                Customise
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Row({ label, desc, checked, disabled, onChange }: { label: string; desc: string; checked: boolean; disabled?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-3">
      <span>
        <span className="font-medium">{label}</span>
        <span className="block text-xs text-[var(--color-stone)]">{desc}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-gold)] disabled:opacity-60"
      />
    </label>
  );
}
