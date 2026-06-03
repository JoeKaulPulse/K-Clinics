'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AnnouncementConfig } from '@/lib/site-config';

// Site-wide banner above the header. Sets the `--ann-h` CSS variable to its own
// height so the fixed header and page content shift down by exactly that much
// (the var defaults to 0, so nothing moves when there's no announcement).
// Dismissible per-message, remembered in localStorage.
export function AnnouncementBar({ a, active }: { a: AnnouncementConfig; active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [dismissed, setDismissed] = useState(true); // assume dismissed until we check (no SSR flash)
  const key = `kc_ann_${hash(a?.message || '')}`;

  useEffect(() => { setDismissed(localStorage.getItem(key) === '1'); }, [key]);

  const show = active && !dismissed;

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (show && ref.current) root.style.setProperty('--ann-h', `${ref.current.offsetHeight}px`);
    else root.style.setProperty('--ann-h', '0px');
    return () => { root.style.setProperty('--ann-h', '0px'); };
  }, [show, a?.message]);

  if (!show) return null;

  return (
    <div
      ref={ref}
      className="fixed inset-x-0 top-0 z-[60] bg-[var(--color-ink)] text-[var(--color-porcelain)] print:hidden"
    >
      <div className="container-lux flex min-h-[2.5rem] items-center justify-center gap-3 py-1.5 text-center text-[0.82rem]">
        <p className="leading-snug">
          {a.message}
          {a.linkHref && a.linkLabel && (
            <a href={a.linkHref} className="ml-2 font-medium text-[var(--color-gold-soft)] underline underline-offset-2 hover:text-[var(--color-porcelain)]">
              {a.linkLabel}
            </a>
          )}
        </p>
        <button
          aria-label="Dismiss announcement"
          onClick={() => { localStorage.setItem(key, '1'); setDismissed(true); }}
          className="absolute right-4 grid h-6 w-6 place-items-center rounded-full text-[color-mix(in_oklab,var(--color-porcelain)_70%,transparent)] transition-colors hover:bg-white/10 hover:text-[var(--color-porcelain)]"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}
