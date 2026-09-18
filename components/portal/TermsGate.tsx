'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// BLD-1845: mandatory T&Cs acceptance. Renders as a full-screen, non-dismissible
// overlay ON TOP of the portal (not a redirect) whenever the signed-in client
// has no recorded acceptance (`termsAcceptedAt` null) — so it covers whichever
// /account page they land on, mirroring the OnboardingHost pattern but without
// an escape hatch: no close button, no backdrop-click, no Escape key. The
// client can only continue by ticking the box and accepting.
export function TermsGate({ accepted }: { accepted: boolean }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(accepted);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Keep focus trapped inside the dialog while it's open — same mechanism as
  // OnboardingModal, minus the Escape-to-close (this gate cannot be dismissed).
  useEffect(() => {
    if (done) return;
    const focusables = () =>
      Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])') ?? [])
        .filter((n) => n.offsetParent !== null);
    const el = dialogRef.current;
    if (el && !el.contains(document.activeElement)) (focusables()[0] ?? el).focus();
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const f = focusables();
      if (f.length === 0) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [done]);

  if (done) return null;

  async function accept() {
    if (!checked || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/account/accept-terms', { method: 'POST' });
      const j = await res.json().catch(() => ({ ok: false }));
      if (j.ok) {
        setDone(true);
        router.refresh();
      } else {
        setError('Something went wrong saving your acceptance. Please try again.');
      }
    } catch {
      setError('Something went wrong saving your acceptance. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    // Intentionally no onClick-to-dismiss on the backdrop, no close button, and
    // no Escape handling — acceptance is mandatory before the portal is usable.
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-[var(--color-ink)]/80 p-4 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-gate-title"
        tabIndex={-1}
        className="relative w-full max-w-lg overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-porcelain)] shadow-[var(--shadow-lift)] outline-none"
      >
        <div className="p-7 md:p-9">
          <p className="text-[0.65rem] uppercase tracking-[0.18em] text-[var(--color-stone)]">Before you continue</p>
          <h2 id="terms-gate-title" className="mt-1 font-[family-name:var(--font-display)] text-2xl leading-tight">
            Please accept our Terms &amp; Conditions
          </h2>
          <p className="mt-3 text-sm text-[var(--color-stone)]">
            We need your agreement to our Terms &amp; Conditions before you can use your account. This covers your
            bookings, cancellation policy, and how we care for your details. It only takes a moment.
          </p>

          <a
            href="/info/terms-conditions"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--color-gold-deep)] underline underline-offset-2 hover:text-[var(--color-ink)]"
          >
            Read the Terms &amp; Conditions →
          </a>

          <label className="mt-6 flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-4 text-sm">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-gold)]"
            />
            <span>I have read and accept the Terms &amp; Conditions</span>
          </label>

          {error && (
            <p role="alert" aria-live="assertive" className="mt-4 rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-4 py-2.5 text-sm text-[var(--color-ink)]">
              {error}
            </p>
          )}

          <div className="mt-7 flex justify-end">
            <button
              onClick={accept}
              disabled={!checked || busy}
              className="rounded-full bg-[var(--color-gold-deep)] px-6 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-gold)] transition-colors hover:bg-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Accept & continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
