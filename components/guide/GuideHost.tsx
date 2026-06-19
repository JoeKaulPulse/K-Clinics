'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Tour } from '@/components/guide/Tour';
import { TOURS, tourForPath } from '@/lib/tours';

// Mounts the context-aware Help launcher + guided tour. Auto-runs once per area
// for new users, then is available on demand from the Help (?) button.
export function GuideHost() {
  const pathname = usePathname();
  const tourId = tourForPath(pathname || '');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!tourId) return;
    try {
      if (!localStorage.getItem(`kc_tour_${tourId}_seen`)) {
        const t = setTimeout(() => setOpen(true), 900);
        return () => clearTimeout(t);
      }
    } catch { /* ignore */ }
  }, [tourId]);

  // Hide on the full-screen messages view so the Help button doesn't overlap the
  // chat composer's send button in the bottom-right.
  if (!tourId || (pathname || '').startsWith('/admin/messages')) return null;
  const tour = TOURS[tourId];

  function close() {
    setOpen(false);
    try { localStorage.setItem(`kc_tour_${tourId}_seen`, '1'); } catch { /* ignore */ }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Help & guided tour"
        title="Help & guided tour"
        className="fixed bottom-5 right-5 z-[150] grid h-11 w-11 place-items-center rounded-full border border-[var(--color-line)] bg-[var(--color-ink)] text-[var(--color-porcelain)] shadow-[var(--shadow-lift)] transition-transform hover:scale-105"
      >
        <span className="text-lg font-[family-name:var(--font-display)]">?</span>
      </button>
      <Tour steps={tour.steps} open={open} onClose={close} />
    </>
  );
}
