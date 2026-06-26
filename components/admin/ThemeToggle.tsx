'use client';

import { useCallback, useEffect, useState } from 'react';
import { ADMIN_THEME_COOKIE, type AdminTheme, isAdminTheme } from '@/lib/admin-theme';

// Light / System / Dark switcher for the admin portal. Applies the choice live
// (no reload) by setting data-theme on <html>, and persists it in a cookie so the
// no-flash script in the root <head> can restore it before paint next time.

function readCookie(): AdminTheme {
  if (typeof document === 'undefined') return 'system';
  const m = document.cookie.match(/(?:^|; )kc_admin_theme=([^;]+)/);
  const v = m ? decodeURIComponent(m[1]) : 'system';
  return isAdminTheme(v) ? v : 'system';
}

function resolveDark(theme: AdminTheme): boolean {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function apply(theme: AdminTheme) {
  document.documentElement.setAttribute('data-theme', resolveDark(theme) ? 'dark' : 'light');
}

const SunIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
const MonitorIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
  </svg>
);
const MoonIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

const OPTIONS: { value: AdminTheme; label: string; icon: () => React.ReactElement }[] = [
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'system', label: 'System', icon: MonitorIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon },
];

export function ThemeToggle() {
  const [theme, setTheme] = useState<AdminTheme>('system');
  useEffect(() => { setTheme(readCookie()); }, []);

  // Follow the OS while in System mode.
  useEffect(() => {
    if (theme !== 'system' || typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const choose = useCallback((next: AdminTheme) => {
    setTheme(next);
    document.cookie = `${ADMIN_THEME_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    apply(next);
  }, []);

  return (
    <div className="px-4 py-2.5">
      <span className="mb-1.5 block text-[0.6rem] uppercase tracking-[0.14em] text-[var(--color-stone)]">Appearance</span>
      <div role="radiogroup" aria-label="Theme" className="flex gap-1 rounded-full border border-[var(--color-line)] bg-[var(--color-bone)] p-1">
        {OPTIONS.map((o) => {
          const active = theme === o.value;
          const Icon = o.icon;
          return (
            <button
              key={o.value}
              role="radio"
              aria-checked={active}
              onClick={() => choose(o.value)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)] ${
                active
                  ? 'bg-[var(--color-ink)] font-medium text-[var(--color-porcelain)]'
                  : 'text-[var(--color-stone)] hover:text-[var(--color-ink)]'
              }`}
            >
              <Icon />
              <span>{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
