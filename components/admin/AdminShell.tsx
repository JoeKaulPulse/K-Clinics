'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { KMark, ClinicsWordmark } from '@/components/brand/marks';
import { site } from '@/lib/site';
import { ClientSearch } from '@/components/admin/ClientSearch';
import { I18nProvider } from '@/components/i18n/I18nProvider';
import { translator, isLocale, LOCALES, LOCALE_LABELS, DEFAULT_LOCALE, type Locale } from '@/lib/i18n';

const nav = [
  { href: '/admin', key: 'nav.overview', exact: true, perm: 'dashboard.view' },
  { href: '/admin/my-day', key: 'nav.myday', perm: undefined },
  { href: '/admin/calendar', key: 'nav.calendar', perm: 'calendar.view' },
  { href: '/admin/bookings', key: 'nav.bookings', perm: 'bookings.view' },
  { href: '/admin/services', key: 'nav.services', perm: 'settings.manage' },
  { href: '/admin/academy', key: 'nav.academy', perm: 'settings.manage' },
  { href: '/admin/careers', key: 'nav.careers', perm: 'settings.manage' },
  { href: '/admin/gallery', key: 'nav.gallery', perm: 'settings.manage' },
  { href: '/admin/gift-vouchers', key: 'nav.gift', perm: 'finance.view' },
  { href: '/admin/consultations', key: 'nav.consultations', perm: 'consultations.view' },
  { href: '/admin/clients', key: 'nav.clients', perm: 'clients.view' },
  { href: '/admin/discounts', key: 'nav.discounts', perm: 'discounts.manage' },
  { href: '/admin/reviews', key: 'nav.reviews', perm: 'reviews.manage' },
  { href: '/admin/rewards', key: 'nav.rewards', perm: 'rewards.view' },
  { href: '/admin/schedule', key: 'nav.schedule', perm: 'schedule.manage' },
  { href: '/admin/tasks', key: 'nav.tasks', perm: undefined, badge: 'tasks' as const },
  { href: '/admin/time-off', key: 'nav.timeoff', perm: undefined, badge: 'timeoff' as const },
  { href: '/admin/inventory', key: 'nav.inventory', perm: 'inventory.view' },
  { href: '/admin/reorder', key: 'nav.reorder', perm: 'inventory.view' },
  { href: '/admin/sops', key: 'nav.sops', perm: 'sop.manage' },
  { href: '/admin/campaigns', key: 'nav.campaigns', perm: 'campaigns.view' },
  { href: '/admin/automations', key: 'nav.automations', perm: 'automations.view' },
  { href: '/admin/activity', key: 'nav.activity', perm: 'staff.view' },
  { href: '/admin/cashflow', key: 'nav.cashflow', perm: 'finance.view' },
  { href: '/admin/reports', key: 'nav.reports', perm: 'finance.view' },
  { href: '/admin/staff', key: 'nav.staff', perm: 'staff.view' },
  { href: '/admin/locations', key: 'nav.locations', perm: 'settings.manage' },
  { href: '/admin/seo', key: 'nav.seo', perm: 'settings.manage' },
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
  location,
}: {
  children: React.ReactNode;
  user?: string;
  can?: string[];
  locale?: Locale;
  location?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const allowed = new Set(can);
  const items = nav.filter((n) => !n.perm || allowed.size === 0 || allowed.has(n.perm));
  // Which clinic the user is viewing. Defaults to the primary site (derived from
  // the clinic locality); pass `location` to override per page in multi-site use.
  const locationLabel = location || site.address.locality.split(',').pop()?.trim() || site.address.region;

  // Locale: server-provided prop wins (no flash); otherwise read the cookie.
  const [locale, setLocale] = useState<Locale>(localeProp ?? DEFAULT_LOCALE);
  useEffect(() => { if (!localeProp) setLocale(readCookieLocale()); }, [localeProp]);
  const t = translator(locale);

  // Sidebar badges — a single lightweight request per shell mount.
  const [pendingTimeOff, setPendingTimeOff] = useState(0);
  const [openTasks, setOpenTasks] = useState(0);
  const canApproveTimeOff = allowed.has('schedule.manage');
  useEffect(() => {
    let on = true;
    fetch('/api/admin/badges')
      .then((r) => r.json())
      .then((j) => { if (on && j?.ok) { setPendingTimeOff(j.pendingTimeOff || 0); setOpenTasks(j.openTasks || 0); } })
      .catch(() => {});
    return () => { on = false; };
  }, []);

  const badgeCount = (badge?: string) =>
    badge === 'timeoff' ? (canApproveTimeOff ? pendingTimeOff : 0) : badge === 'tasks' ? openTasks : 0;

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
          <div className="mb-7 flex justify-center px-2">
            <div className="inline-flex flex-col items-center text-[var(--color-ink)]">
              <span className="block h-9 w-[1.35rem]"><KMark /></span>
              <span className="mt-3 block h-[0.62rem] w-[6.75rem]"><ClinicsWordmark /></span>
              <p className="mt-3 pl-[0.3em] text-center text-[0.66rem] font-medium uppercase tracking-[0.3em] text-[var(--color-stone)]">
                {locationLabel}
                <span className="text-[var(--color-stone-soft)]"> · CRM</span>
              </p>
            </div>
          </div>
          {allowed.has('clients.view') && <ClientSearch placeholder={t('shell.searchClients')} />}
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
                  {badgeCount(n.badge) > 0 && (
                    <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[0.65rem] font-semibold text-amber-950">{badgeCount(n.badge)}</span>
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
            <div className="mt-2 flex items-center gap-3 px-2">
              <Link href="/admin/profile" className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">{t('shell.profile')}</Link>
              <span className="text-[var(--color-line)]">·</span>
              <button onClick={signOut} className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">
                {t('shell.signOut')}
              </button>
            </div>
          </div>
        </aside>
        <main className="flex-1 p-5 md:p-8 lg:p-10">{children}</main>
      </div>
    </I18nProvider>
  );
}
