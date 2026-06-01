'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { KMark, ClinicsWordmark } from '@/components/brand/marks';
import { portalTranslator, PORTAL_LOCALE_COOKIE } from '@/lib/i18n-portal';
import { LOCALES, LOCALE_LABELS, isLocale, DEFAULT_LOCALE, type Locale } from '@/lib/i18n';

const nav = [
  { href: '/account', key: 'nav.overview' },
  { href: '/account/appointments', key: 'nav.appointments' },
  { href: '/account/rewards', key: 'nav.rewards' },
  { href: '/account/assessments', key: 'nav.assessments' },
  { href: '/account/aftercare', key: 'nav.aftercare' },
  { href: '/account/invoices', key: 'nav.invoices' },
  { href: '/account/profile', key: 'nav.profile' },
];

function readCookieLocale(): Locale {
  if (typeof document === 'undefined') return DEFAULT_LOCALE;
  const m = document.cookie.match(/(?:^|;\s*)kc_clang=([^;]+)/);
  return m && isLocale(m[1]) ? (m[1] as Locale) : DEFAULT_LOCALE;
}

export function PortalShell({ firstName, locale: localeProp, children }: { firstName: string; locale?: Locale; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>(localeProp ?? DEFAULT_LOCALE);
  useEffect(() => { if (!localeProp) setLocale(readCookieLocale()); }, [localeProp]);
  const t = portalTranslator(locale);

  async function changeLanguage(next: Locale) {
    setLocale(next);
    document.cookie = `${PORTAL_LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}`;
    await fetch('/api/account/locale', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locale: next }) }).catch(() => {});
    router.refresh();
  }

  async function signOut() {
    await fetch('/api/account/logout', { method: 'POST' });
    router.push('/account/login');
    router.refresh();
  }

  const navLink = (active: boolean, mobile = false) =>
    `${mobile ? 'shrink-0' : ''} rounded-full px-4 py-2 text-sm font-medium transition-colors ${
      active ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
    }`;

  return (
    <div className="mx-auto flex min-h-screen max-w-[88rem] flex-col px-[var(--gutter)]">
      <header className="flex items-center justify-between gap-4 border-b border-[var(--color-line)] py-5">
        <Link href="/account" aria-label="K Clinics" className="flex items-center gap-2.5 text-[var(--color-ink)]">
          <span className="block h-8 w-[1.25rem]"><KMark /></span>
          <span className="hidden h-[0.62rem] w-[5.5rem] sm:block"><ClinicsWordmark /></span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Portal">
          {nav.map((n) => {
            const active = n.href === '/account' ? pathname === n.href : pathname.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} aria-current={active ? 'page' : undefined} className={navLink(active)}>
                {t(n.key)}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          <LanguageToggle locale={locale} onChange={changeLanguage} label={t('portal.language')} />
          <span className="hidden text-sm text-[var(--color-stone)] sm:block">{t('portal.greeting', { name: firstName })}</span>
          <button onClick={signOut} className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-medium text-[var(--color-ink-soft)] transition-colors hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]">
            {t('portal.signOut')}
          </button>
        </div>
      </header>

      {/* Mobile nav */}
      <nav className="flex gap-1 overflow-x-auto border-b border-[var(--color-line)] py-3 md:hidden" aria-label="Portal">
        {nav.map((n) => {
          const active = n.href === '/account' ? pathname === n.href : pathname.startsWith(n.href);
          return <Link key={n.href} href={n.href} className={navLink(active, true)}>{t(n.key)}</Link>;
        })}
      </nav>

      <main className="flex-1 py-8 md:py-12">{children}</main>

      <footer className="border-t border-[var(--color-line)] py-6 text-xs text-[var(--color-stone)]">
        {t('portal.footer')}{' '}
        <a href="tel:+442072500000" className="font-medium text-[var(--color-ink-soft)]">+44 20 7250 0000</a>.
      </footer>
    </div>
  );
}

function LanguageToggle({ locale, onChange, label }: { locale: Locale; onChange: (l: Locale) => void; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        aria-label={label}
        className="flex items-center gap-1.5 rounded-full border border-[var(--color-line)] px-3 py-2 text-sm font-medium text-[var(--color-ink-soft)] transition-colors hover:border-[var(--color-gold)]"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
        {locale.toUpperCase()}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white shadow-[var(--shadow-soft)]">
          {LOCALES.map((l) => (
            <button key={l} onMouseDown={() => onChange(l)} className={`block w-full px-4 py-2 text-left text-sm ${l === locale ? 'bg-[var(--color-bone)] font-medium' : 'hover:bg-[var(--color-bone)]'}`}>
              {LOCALE_LABELS[l]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
