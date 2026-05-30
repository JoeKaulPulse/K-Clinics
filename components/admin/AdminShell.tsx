'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { KMark } from '@/components/brand/marks';

const nav = [
  { href: '/admin', label: 'Overview', exact: true },
  { href: '/admin/bookings', label: 'Bookings' },
  { href: '/admin/consultations', label: 'Consultations' },
  { href: '/admin/clients', label: 'Clients' },
  { href: '/admin/campaigns', label: 'Campaigns' },
  { href: '/admin/automations', label: 'Automations' },
];

export function AdminShell({ children, user }: { children: React.ReactNode; user?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-1 border-b border-[var(--color-line)] bg-[var(--color-porcelain)] p-4 lg:w-64 lg:border-b-0 lg:border-r lg:p-6">
        <div className="mb-6 flex items-center gap-3 px-2 text-[var(--color-ink)]">
          <span className="h-7 w-4"><KMark /></span>
          <span className="font-[family-name:var(--font-display)] text-lg">K Clinics CRM</span>
        </div>
        <nav className="flex gap-1 overflow-x-auto lg:flex-col">
          {nav.map((n) => {
            const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`whitespace-nowrap rounded-[var(--radius-sm)] px-4 py-2.5 text-sm transition-colors ${
                  active ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-bone)]'
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto hidden border-t border-[var(--color-line)] pt-4 lg:block">
          {user && <p className="px-2 text-xs text-[var(--color-stone)]">{user}</p>}
          <button onClick={signOut} className="mt-2 px-2 text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-5 md:p-8 lg:p-10">{children}</main>
    </div>
  );
}
