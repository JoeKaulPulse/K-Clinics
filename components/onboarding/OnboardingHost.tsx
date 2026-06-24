'use client';

import { useEffect, useState } from 'react';
import { OnboardingModal, type OnbStep } from '@/components/onboarding/OnboardingModal';
import { getConsent } from '@/components/legal/CookieConsent';

// Auto-opens the onboarding for users who haven't completed it; if they skip,
// it stays out of the way but shows a gentle "finish setting up" prompt.
// `waitForConsent`: on surfaces that also show the cookie-consent banner (the
// academy portal lives under the marketing layout), defer the auto-open until the
// cookie choice is made so the two overlays don't stack on a first-run visit.
export function OnboardingHost({ pending, title, intro, steps, initial, endpoint, waitForConsent = false }: {
  pending: boolean; title: string; intro: string; steps: OnbStep[]; initial: Record<string, unknown>; endpoint: string; waitForConsent?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(!pending);

  useEffect(() => {
    if (!pending) return;
    let dismissed = false;
    try { dismissed = sessionStorage.getItem('kc_onb_dismissed') === '1'; } catch { /* ignore */ }
    if (dismissed) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const start = () => { timer = setTimeout(() => setOpen(true), 700); };

    // Cookie choice first where a banner shares the screen — otherwise open now.
    if (waitForConsent && getConsent() === null) {
      const onConsent = () => { window.removeEventListener('kc-consent', onConsent); start(); };
      window.addEventListener('kc-consent', onConsent);
      return () => { window.removeEventListener('kc-consent', onConsent); if (timer) clearTimeout(timer); };
    }
    start();
    return () => { if (timer) clearTimeout(timer); };
  }, [pending, waitForConsent]);

  if (done) return null;

  function close(completed: boolean) {
    setOpen(false);
    if (completed) setDone(true);
    else { try { sessionStorage.setItem('kc_onb_dismissed', '1'); } catch { /* ignore */ } }
  }

  return (
    <>
      {open && <OnboardingModal title={title} intro={intro} steps={steps} initial={initial} endpoint={endpoint} onClose={close} />}
      {!open && (
        <button onClick={() => setOpen(true)} className="fixed bottom-5 left-5 z-[150] flex items-center gap-2 rounded-full border border-[var(--color-gold)] bg-[var(--color-porcelain)] px-4 py-2 text-sm shadow-[var(--shadow-soft)] hover:bg-[var(--color-bone)]">
          <span aria-hidden>✦</span> Finish setting up
        </button>
      )}
    </>
  );
}
