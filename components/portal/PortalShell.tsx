'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from '@/components/brand/Logo';

const nav = [
  { href: '/account', label: 'Overview' },
  { href: '/account/appointments', label: 'Appointments' },
  { href: '/account/assessments', label: 'Health forms' },
  { href: '/account/invoices', label: 'Payments' },
  { href: '/account/profile', label: 'Profile' },
];

export function PortalShell({ firstName, children }: { firstName: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch('/api/account/logout', { method: 'POST' });
    router.push('/account/login');
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-[var(--gutter)]">
      <header className="flex items-center justify-between gap-4 border-b border-[var(--color-line)] py-5">
        <Link href="/account" aria-label="K Clinics" className="text-[var(--color-ink)]">
          <span className="block h-8 w-[1.1rem] sm:h-9 sm:w-5">
            <Logo />
          </span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Portal">
          {nav.map((n) => {
            const active = n.href === '/account' ? pathname === n.href : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? 'page' : undefined}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]'
                    : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-[var(--color-stone)] sm:block">Hi, {firstName}</span>
          <button
            onClick={signOut}
            className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-medium text-[var(--color-ink-soft)] transition-colors hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Mobile nav */}
      <nav className="flex gap-1 overflow-x-auto border-b border-[var(--color-line)] py-3 md:hidden" aria-label="Portal">
        {nav.map((n) => {
          const active = n.href === '/account' ? pathname === n.href : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
                active ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'text-[var(--color-ink-soft)]'
              }`}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>

      <main className="flex-1 py-8 md:py-12">{children}</main>

      <footer className="border-t border-[var(--color-line)] py-6 text-xs text-[var(--color-stone)]">
        Your data is encrypted and held securely. Need help? Call{' '}
        <a href="tel:+442072500000" className="font-medium text-[var(--color-ink-soft)]">
          +44 20 7250 0000
        </a>
        .
      </footer>
    </div>
  );
}
