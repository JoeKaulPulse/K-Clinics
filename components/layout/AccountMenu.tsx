'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const PersonIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
    <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.5" />
    <path d="M5 19.5c1.6-3 4-4.5 7-4.5s5.4 1.5 7 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

/** Marketing-header account control. Shows "Sign in" for guests; once a client
 *  is signed in (shared httpOnly portal cookie), shows their name + a dropdown
 *  to jump straight into the portal or sign out — no re-login prompt. */
export function AccountMenu({ light }: { light: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<{ signedIn: boolean; firstName?: string } | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let on = true;
    fetch('/api/account/me')
      .then((r) => r.json())
      .then((j) => { if (on) setState(j); })
      .catch(() => { if (on) setState({ signedIn: false }); });
    return () => { on = false; };
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const linkCls = `inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${
    light ? 'text-[color-mix(in_oklab,var(--color-porcelain)_88%,transparent)] hover:text-[var(--color-porcelain)]' : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
  }`;

  // While unknown, render the guest link so SSR/markup stays stable.
  if (!state?.signedIn) {
    return (
      <Link href="/account/login" aria-label="Client portal sign in" className={linkCls}>
        <PersonIcon /> Sign in
      </Link>
    );
  }

  async function signOut() {
    await fetch('/api/account/logout', { method: 'POST' }).catch(() => {});
    setState({ signedIn: false });
    setOpen(false);
    router.refresh();
  }

  const items = [
    { href: '/account', label: 'My portal' },
    { href: '/account/appointments', label: 'Appointments' },
    { href: '/account/assessments', label: 'Health forms' },
    { href: '/account/invoices', label: 'Invoices' },
    { href: '/account/profile', label: 'Profile' },
  ];

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" className={linkCls}>
        <PersonIcon />
        {state.firstName || 'Account'}
        <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" aria-hidden>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white py-1.5 text-[var(--color-ink)] shadow-[var(--shadow-soft)]">
          {state.firstName && (
            <p className="border-b border-[var(--color-line)] px-4 pb-2 pt-1 text-xs text-[var(--color-stone)]">Signed in as <span className="font-medium text-[var(--color-ink)]">{state.firstName}</span></p>
          )}
          {items.map((i) => (
            <Link key={i.href} href={i.href} role="menuitem" onClick={() => setOpen(false)} className="block px-4 py-2 text-sm hover:bg-[var(--color-bone)]">
              {i.label}
            </Link>
          ))}
          <button onClick={signOut} role="menuitem" className="mt-1 block w-full border-t border-[var(--color-line)] px-4 py-2 text-left text-sm text-[var(--color-stone)] hover:bg-[var(--color-bone)] hover:text-[var(--color-blush)]">
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
