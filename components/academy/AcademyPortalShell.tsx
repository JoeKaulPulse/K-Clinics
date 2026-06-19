'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { KMark, ClinicsWordmark } from '@/components/brand/marks';
import { GuideHost } from '@/components/guide/GuideHost';
import { Aurora } from '@/components/ui/Aurora';
import { site } from '@/lib/site';

// BLD-528: the trainee portal's own chrome — a dedicated shell mirroring the
// client portal (components/portal/PortalShell), so the academy app reads as a
// portal rather than a marketing page. The marketing header/footer are hidden on
// these routes (see HideOnAcademyPortal in the marketing layout).
const nav = [
  { href: '/academy/portal', label: 'My courses' },
  { href: '/academy/practice', label: 'Practice & papers' },
  { href: '/academy/leaderboard', label: 'Progress' },
  { href: '/academy/settings', label: 'Settings' },
];

export function AcademyPortalShell({ firstName, children }: { firstName?: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch('/api/academy/account/logout', { method: 'POST' }).catch(() => {});
    router.push('/academy/portal');
    router.refresh();
  }

  const isActive = (href: string) => (href === '/academy/portal' ? pathname === href : pathname.startsWith(href));
  const navLink = (active: boolean, mobile = false) =>
    `relative ${mobile ? 'shrink-0' : ''} rounded-full px-4 py-2 text-sm font-medium [transition:color_0.4s_var(--ease-lux),background-color_0.4s_var(--ease-lux)] ${
      active ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)] shadow-[var(--shadow-soft)]' : 'text-[var(--color-ink-soft)] hover:bg-[color-mix(in_oklab,var(--color-ink)_6%,transparent)] hover:text-[var(--color-ink)]'
    }`;

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Ambient brand wash — matches the client portal's whisper-soft treatment. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <Aurora className="opacity-50" />
        <span className="absolute inset-0 bg-[radial-gradient(130%_90%_at_85%_-10%,color-mix(in_oklab,var(--color-gold)_10%,transparent),transparent_55%)]" />
        <span className="grain absolute inset-0 opacity-[0.5]" />
      </div>

      {/* Sticky frosted bar: header + mobile nav */}
      <div className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-[color-mix(in_oklab,var(--color-porcelain)_82%,transparent)] backdrop-blur-xl">
        <div className="mx-auto w-full max-w-[88rem] px-[var(--gutter)]">
          <header className="flex items-center justify-between gap-4 py-4">
            <Link href="/academy/portal" aria-label="K Academy" className="group flex items-center gap-2.5 text-[var(--color-ink)]">
              <span className="block h-8 w-[1.25rem] transition-transform duration-500 [transition-timing-function:var(--ease-lux)] group-hover:-translate-y-0.5"><KMark /></span>
              <span className="hidden h-[0.62rem] w-[5.5rem] sm:block"><ClinicsWordmark /></span>
              <span className="hidden text-[0.6rem] uppercase tracking-[0.28em] text-[var(--color-stone)] sm:block">Academy</span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex" aria-label="Trainee portal">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} aria-current={isActive(n.href) ? 'page' : undefined} className={navLink(isActive(n.href))}>{n.label}</Link>
              ))}
            </nav>
            <div className="flex items-center gap-3">
              {firstName && <span className="hidden text-sm text-[var(--color-stone)] sm:block">Hi, {firstName}</span>}
              <button onClick={signOut} className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-medium text-[var(--color-ink-soft)] transition-colors hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]">Sign out</button>
            </div>
          </header>

          {/* Mobile nav */}
          <nav className="flex gap-1 overflow-x-auto pb-3 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Trainee portal">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} aria-current={isActive(n.href) ? 'page' : undefined} className={navLink(isActive(n.href), true)}>{n.label}</Link>
            ))}
          </nav>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[88rem] flex-1 flex-col px-[var(--gutter)]">
        <main className="flex-1 py-9 md:py-12">{children}</main>

        <footer className="mt-8 flex flex-col gap-3 border-t border-[var(--color-line)] py-7 text-xs text-[var(--color-stone)] sm:flex-row sm:items-center sm:justify-between">
          <p>K Academy — accredited aesthetics training. Questions? Call{' '}
            <a href={site.phoneHref} className="font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-gold)]">{site.phone}</a>.
          </p>
          <nav className="flex flex-wrap gap-x-5 gap-y-1" aria-label="Portal footer">
            <Link href="/academy" className="hover:text-[var(--color-gold)]">Browse courses</Link>
            <Link href="/academy/funding" className="hover:text-[var(--color-gold)]">Funding</Link>
            <Link href="/contact" className="hover:text-[var(--color-gold)]">Contact</Link>
          </nav>
        </footer>
      </div>
      <GuideHost />
    </div>
  );
}
