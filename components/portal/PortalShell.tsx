'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { KMark, ClinicsWordmark } from '@/components/brand/marks';
import { GuideHost } from '@/components/guide/GuideHost';
import { Aurora } from '@/components/ui/Aurora';
import { site } from '@/lib/site';
import { portalTranslator, PORTAL_LOCALE_COOKIE } from '@/lib/i18n-portal';
import { LOCALES, LOCALE_LABELS, isLocale, DEFAULT_LOCALE, type Locale } from '@/lib/i18n';

const nav = [
  { href: '/account', key: 'nav.overview' },
  { href: '/account/appointments', key: 'nav.appointments' },
  { href: '/account/rewards', key: 'nav.rewards' },
  { href: '/account/assessments', key: 'nav.assessments' },
  { href: '/account/aftercare', key: 'nav.aftercare' },
  { href: '/account/invoices', key: 'nav.invoices' },
  { href: '/account/gift-cards', key: 'nav.giftcards' },
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

  // The active background is a single shared element (motion layoutId) that
  // glides between items on navigation — the portal's signature transition. The
  // link itself only carries the text colour; the gliding pill is rendered
  // behind it. Under reduced-motion the layout animation is disabled globally
  // (MotionConfig reducedMotion="user"), so the pill snaps instead of glides.
  const navLink = (active: boolean, mobile = false) =>
    `relative ${mobile ? 'shrink-0' : ''} rounded-full px-4 py-2 text-sm font-medium [transition:color_0.4s_var(--ease-lux)] ${
      active ? 'text-[var(--color-porcelain)]' : 'text-[var(--color-ink-soft)] hover:bg-[color-mix(in_oklab,var(--color-ink)_6%,transparent)] hover:text-[var(--color-ink)]'
    }`;

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Ambient brand wash — the marketing-site depth treatment, kept whisper-soft
          on the light portal so content stays crisp. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <Aurora className="opacity-50" />
        <span className="absolute inset-0 bg-[radial-gradient(130%_90%_at_85%_-10%,color-mix(in_oklab,var(--color-gold)_10%,transparent),transparent_55%)]" />
        <span className="grain absolute inset-0 opacity-[0.5]" />
      </div>

      {/* Sticky frosted bar: header + mobile nav */}
      <div className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-[color-mix(in_oklab,var(--color-porcelain)_82%,transparent)] backdrop-blur-xl">
        <div className="mx-auto w-full max-w-[88rem] px-[var(--gutter)]">
          <header className="flex items-center justify-between gap-4 py-4">
            <Link href="/account" aria-label="KClinics" className="group flex items-center gap-2.5 text-[var(--color-ink)]">
              <span className="block h-8 w-[1.25rem] transition-transform duration-500 [transition-timing-function:var(--ease-lux)] group-hover:-translate-y-0.5"><KMark /></span>
              <span className="hidden h-[0.62rem] w-[5.5rem] sm:block"><ClinicsWordmark /></span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex" aria-label="Portal">
              {nav.map((n) => {
                const active = n.href === '/account' ? pathname === n.href : pathname.startsWith(n.href);
                return (
                  <Link key={n.href} href={n.href} data-tour={n.key} aria-current={active ? 'page' : undefined} className={navLink(active)}>
                    {active && (
                      <motion.span
                        aria-hidden
                        layoutId="portal-nav-pill"
                        className="absolute inset-0 rounded-full bg-[var(--color-ink)] shadow-[var(--shadow-soft)]"
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      />
                    )}
                    <span className="relative z-10">{t(n.key)}</span>
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
          <nav className="flex gap-1 overflow-x-auto pb-3 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Portal">
            {nav.map((n) => {
              const active = n.href === '/account' ? pathname === n.href : pathname.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href} aria-current={active ? 'page' : undefined} className={navLink(active, true)}>
                  {active && (
                    <motion.span
                      aria-hidden
                      layoutId="portal-nav-pill-mobile"
                      className="absolute inset-0 rounded-full bg-[var(--color-ink)] shadow-[var(--shadow-soft)]"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10">{t(n.key)}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[88rem] flex-1 flex-col px-[var(--gutter)]">
        <main className="flex-1 py-9 md:py-14">{children}</main>

        <footer className="mt-8 flex flex-col gap-3 border-t border-[var(--color-line)] py-7 text-xs text-[var(--color-stone)] sm:flex-row sm:items-center sm:justify-between">
          <p>{t('portal.footer')}{' '}
            <a href={site.phoneHref} className="font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-gold)]">{site.phone}</a>.
          </p>
          <nav className="flex flex-wrap gap-x-5 gap-y-1" aria-label="Portal footer">
            <Link href="/book" className="hover:text-[var(--color-gold)]">{t('dash.book')}</Link>
            <Link href="/contact" className="hover:text-[var(--color-gold)]">Contact</Link>
            <Link href="/info/website-privacy-terms" className="hover:text-[var(--color-gold)]">Privacy</Link>
          </nav>
        </footer>
      </div>
      <GuideHost />
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
