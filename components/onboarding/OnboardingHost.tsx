'use client';

import { useEffect, useState } from 'react';
import { OnboardingModal, type OnbStep } from '@/components/onboarding/OnboardingModal';

// Auto-opens the onboarding for users who haven't completed it; if they skip,
// it stays out of the way but shows a gentle "finish setting up" prompt.
export function OnboardingHost({ pending, title, intro, steps, initial, endpoint }: {
  pending: boolean; title: string; intro: string; steps: OnbStep[]; initial: Record<string, unknown>; endpoint: string;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(!pending);

  useEffect(() => {
    if (!pending) return;
    let dismissed = false;
    try { dismissed = sessionStorage.getItem('kc_onb_dismissed') === '1'; } catch { /* ignore */ }
    if (!dismissed) { const t = setTimeout(() => setOpen(true), 700); return () => clearTimeout(t); }
  }, [pending]);

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
