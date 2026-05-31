'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { KMark } from '@/components/brand/marks';
import { I18nProvider } from '@/components/i18n/I18nProvider';
import { translator, isLocale, LOCALES, LOCALE_LABELS, DEFAULT_LOCALE, type Locale } from '@/lib/i18n';

const nav = [
  { href: '/admin', key: 'nav.overview', exact: true, perm: 'dashboard.view' },
  { href: '/admin/my-day', key: 'nav.myday', perm: undefined },
  { href: '/admin/calendar', key: 'nav.calendar', perm: 'calendar.view' },
  { href: '/admin/bookings', key: 'nav.bookings', perm: 'bookings.view' },
  { href: '/admin/consultations', key: 'nav.consultations', perm: 'consultations.view' },
  { href: '/admin/clients', key: 'nav.clients', perm: 'clients.view' },
  { href: '/admin/schedule', key: 'nav.schedule', perm: 'schedule.manage' },
  { href: '/admin/time-off', key: 'nav.timeoff', perm: undefined, badge: 'timeoff' as const },
  { href: '/admin/sops', key: 'nav.sops', perm: 'sop.manage' },
  { href: '/admin/campaigns', key: 'nav.campaigns', perm: 'campaigns.view' },
  { href: '/admin/automations', key: 'nav.automations', perm: 'automations.view' },
  { href: '/admin/activity', key: 'nav.activity', perm: 'staff.view' },
  { href: '/admin/staff', key: 'nav.staff', perm: 'staff.view' },
  { href: '/admin/integrations', key: 'nav.integrations', perm: 'settings.manage' },
  { href: '/admin/settings', key: 'nav.settings', perm: 'settings.manage' },
];

function readCookieLocale(): Locale {
  if (typeof document === 'undefined') return DEFAULT_LOCALE;
  const m = document.cookie.match(/(?:^|;\s*)kc_lang=([^;]+)/);
  return m && isLocale(m[1]) ? (m[1] as Locale) : DEFAULT_LOCALE;
}

export function AdminShell({
  children,
  user,
  can = [],
  locale: localeProp,
}: {
  children: React.ReactNode;
  user?: string;
  can?: string[];
  locale?: Locale;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const allowed = new Set(can);
  const items = nav.filter((n) => !n.perm || allowed.size === 0 || allowed.has(n.perm));

  // Locale: server-provided prop wins (no flash); otherwise read the cookie.
  const [locale, setLocale] = useState<Locale>(localeProp ?? DEFAULT_LOCALE);
  useEffect(() => { if (!localeProp) setLocale(readCookieLocale()); }, [localeProp]);
  const t = translator(locale);

  // Pending time-off approvals badge (managers only).
  const [pendingTimeOff, setPendingTimeOff] = useState(0);
  const canApproveTimeOff = allowed.has('schedule.manage');
  useEffect(() => {
    if (!canApproveTimeOff) return;
    let on = true;
    fetch('/api/admin/time-off?count=pending')
      .then((r) => r.json())
      .then((j) => { if (on && j?.ok) setPendingTimeOff(j.pending || 0); })
      .catch(() => {});
    return () => { on = false; };
  }, [canApproveTimeOff, pathname]);

  async function changeLanguage(next: Locale) {
    setLocale(next);
    document.cookie = `kc_lang=${next}; path=/; max-age=${60 * 60 * 24 * 365}`;
    await fetch('/api/admin/locale', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locale: next }) }).catch(() => {});
    router.refresh();
  }

  async function signOut() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  }

  return (
    <I18nProvider locale={locale}>
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="flex shrink-0 flex-col gap-1 border-b border-[var(--color-line)] bg-[var(--color-porcelain)] p-4 lg:w-64 lg:border-b-0 lg:border-r lg:p-6">
          <div className="mb-6 flex items-center gap-3 px-2 text-[var(--color-ink)]">
            <span className="h-7 w-4"><KMark /></span>
            <span className="font-[family-name:var(--font-display)] text-lg">{t('shell.crm')}</span>
          </div>
          <nav className="flex gap-1 overflow-x-auto lg:flex-col">
            {items.map((n) => {
              const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex items-center justify-between gap-2 whitespace-nowrap rounded-[var(--radius-sm)] px-4 py-2.5 text-sm transition-colors ${
                    active ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-bone)]'
                  }`}
                >
                  <span>{t(n.key)}</span>
                  {n.badge === 'timeoff' && canApproveTimeOff && pendingTimeOff > 0 && (
                    <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[0.65rem] font-semibold text-amber-950">{pendingTimeOff}</span>
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto hidden border-t border-[var(--color-line)] pt-4 lg:block">
            {/* Language switcher */}
            <label className="mb-3 block px-2">
              <span className="mb-1 block text-[0.65rem] uppercase tracking-[0.14em] text-[var(--color-stone)]">{t('shell.language')}</span>
              <select
                value={locale}
                onChange={(e) => changeLanguage(e.target.value as Locale)}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm outline-none focus:border-[var(--color-gold)]"
              >
                {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_LABELS[l]}</option>)}
              </select>
            </label>
            {user && <p className="px-2 text-xs text-[var(--color-stone)]">{user}</p>}
            <button onClick={signOut} className="mt-2 px-2 text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">
              {t('shell.signOut')}
            </button>
          </div>
        </aside>
        <main className="flex-1 p-5 md:p-8 lg:p-10">{children}</main>
      </div>
    </I18nProvider>
  );
}
