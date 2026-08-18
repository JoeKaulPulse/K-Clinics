'use client';

import { useEffect, useRef, useState } from 'react';
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

// Mirror both choices into readable first-party cookies so the SERVER can
// verify consent too — for behavioural data (session replay, analytics cookie)
// and for gating the server-side GA4/Meta conversion sends in lib/conversions.ts
// (marketing cookie) — cookies are sent with requests, localStorage is not.
// Necessary-purpose by nature: it only ever restates the visitor's own choice.
function mirrorConsentCookies(v: ConsentValue) {
  try {
    document.cookie = v.analytics
      ? `kc_analytics_consent=1; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
      : 'kc_analytics_consent=; path=/; max-age=0; SameSite=Lax';
    document.cookie = v.marketing
      ? `kc_marketing_consent=1; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
      : 'kc_marketing_consent=; path=/; max-age=0; SameSite=Lax';
  } catch { /* non-browser */ }
}

function save(v: ConsentValue) {
  localStorage.setItem(KEY, JSON.stringify(v));
  mirrorConsentCookies(v);
  window.dispatchEvent(new CustomEvent('kc-consent', { detail: v }));
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function CookieConsent() {
  const [show, setShow] = useState(false);
  const [customise, setCustomise] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  // BLD-1355: the full explanation collapses behind "Learn more" so the banner
  // stays short enough on a 375x812 mobile viewport for both action buttons to
  // sit fully inside the visible viewport on first paint — no scrolling inside
  // the banner needed to find "Reject non-essential".
  const [expanded, setExpanded] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const stored = getConsent();
    if (!stored) setShow(true);
    // Re-mirror a stored choice on every load. The banner only writes the
    // cookies when it is interacted with, and it never reappears once a choice
    // is in localStorage — so visitors who chose before a given mirror cookie
    // existed would otherwise never get it, and the server would read their
    // consent as "not given" forever.
    else mirrorConsentCookies(stored);
    // Allow re-opening from a footer "Cookie settings" link.
    const open = () => { setCustomise(true); setShow(true); };
    window.addEventListener('kc-open-consent', open);
    return () => window.removeEventListener('kc-open-consent', open);
  }, []);

  // Auto-focus first button on open; restore prior focus on close. The banner
  // is deliberately NON-modal (PRJ-939.11): it has no backdrop and the page
  // behind stays scrollable and clickable, so it must not claim aria-modal or
  // trap Tab — keyboard users can browse the page and come back to it, exactly
  // as mouse users can.
  useEffect(() => {
    if (show) {
      prevFocusRef.current = document.activeElement as HTMLElement;
      requestAnimationFrame(() => {
        dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
      });
    } else if (prevFocusRef.current) {
      prevFocusRef.current.focus();
      prevFocusRef.current = null;
    }
  }, [show]);

  function decide(a: boolean, m: boolean) {
    save({ necessary: true, analytics: a, marketing: m, ts: Date.now() });
    setShow(false);
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          ref={dialogRef}
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          role="region"
          aria-label="Cookie consent"
          // BLD-1152: right-20 on mobile keeps the banner clear of the fixed
          // WhatsApp lead button (bottom-5 right-5), which it used to cover on
          // every first visit — the button stays tappable beside the banner.
          // BLD-1355: max-h-[85vh] (was 38vh) so the collapsed banner never
          // needs its own internal scroll just to reveal the action buttons on
          // a short mobile viewport; the short default copy below keeps actual
          // content well under that anyway.
          className="fixed bottom-3 left-3 right-20 z-[80] mx-auto flex max-h-[85vh] max-w-2xl flex-col overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4 shadow-[var(--shadow-lift)] sm:p-5 md:bottom-6 md:left-6 md:right-auto md:max-h-none md:overflow-visible md:p-6"
        >
          <p className="font-[family-name:var(--font-display)] text-lg">Your privacy, your choice</p>
          {expanded ? (
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-stone)]">
              We use essential cookies to make our site work. With your consent, we&apos;d also like to use analytics and
              marketing cookies to improve your experience. You can change your mind anytime. See our{' '}
              <Link href="/info/privacy-policy" className="underline">Privacy Policy</Link>.
            </p>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-stone)]">
              We use essential cookies, plus analytics and marketing cookies if you consent.{' '}
              <button type="button" onClick={() => setExpanded(true)} className="underline underline-offset-2 hover:text-[var(--color-ink)]">
                Learn more
              </button>
            </p>
          )}

          {customise && (
            <div className="mt-4 space-y-2 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)] p-4 text-sm">
              <Row label="Strictly necessary" desc="Required for the site to function. Always on." checked disabled />
              <Row label="Analytics" desc="Helps us understand how the site is used." checked={analytics} onChange={setAnalytics} />
              <Row label="Marketing" desc="Used to personalise offers and measure campaigns." checked={marketing} onChange={setMarketing} />
            </div>
          )}

          {/* BLD-1355: stacked, equal-width, equally-styled buttons on mobile so
              "Reject non-essential" is never squeezed onto a wrapped row below
              the fold and never looks like the lesser option — both are full
              tap targets at the same visual weight; side-by-side once there's
              room from sm: up. */}
          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
            <button onClick={() => decide(true, true)} className="rounded-full bg-[var(--color-gold-deep)] px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-[var(--color-ink)] sm:flex-none">
              Accept all
            </button>
            <button onClick={() => decide(false, false)} className="rounded-full border border-[var(--color-ink)] px-5 py-2.5 text-center text-sm font-medium hover:bg-[var(--color-bone)] sm:flex-none">
              Reject non-essential
            </button>
            {customise ? (
              <button onClick={() => decide(analytics, marketing)} className="rounded-full border border-[var(--color-line)] px-5 py-2.5 text-center text-sm font-medium hover:bg-[var(--color-bone)] sm:flex-none">
                Save choices
              </button>
            ) : (
              <button onClick={() => setCustomise(true)} className="rounded-full px-5 py-2.5 text-center text-sm font-medium text-[var(--color-stone)] hover:text-[var(--color-ink)] sm:flex-none">
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
