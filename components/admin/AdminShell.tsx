'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { KMark, ClinicsWordmark } from '@/components/brand/marks';
import { site } from '@/lib/site';
import { GlobalSearch } from '@/components/admin/GlobalSearch';
import { GuideHost } from '@/components/guide/GuideHost';
import { CloseDownReminder } from '@/components/admin/CloseDownReminder';
import { ReportProblem } from '@/components/admin/ReportProblem';
import { I18nProvider } from '@/components/i18n/I18nProvider';
import { translator, isLocale, LOCALES, LOCALE_LABELS, DEFAULT_LOCALE, type Locale } from '@/lib/i18n';

type NavItem = { href: string; key: string; exact?: boolean; perm?: string; badge?: 'tasks' | 'timeoff' | 'chat' };
type GroupIconKey = 'today' | 'clients' | 'loyalty' | 'catalogue' | 'website' | 'operations' | 'marketing' | 'finance' | 'admin';
const navGroups: { heading?: string; icon?: GroupIconKey; items: NavItem[] }[] = [
  { heading: 'nav.group.today', icon: 'today', items: [
    { href: '/admin', key: 'nav.overview', exact: true, perm: 'dashboard.view' },
    { href: '/admin/my-day', key: 'nav.myday' },
    { href: '/admin/calendar', key: 'nav.calendar', perm: 'calendar.view' },
    { href: '/admin/tasks', key: 'nav.tasks', badge: 'tasks' },
    { href: '/admin/time-off', key: 'nav.timeoff', badge: 'timeoff' },
  ] },
  // Clients & bookings: the people and conversations. Loyalty/offers split out
  // below so this group stays focused on records and front-desk work.
  { heading: 'nav.group.clients', icon: 'clients', items: [
    { href: '/admin/bookings', key: 'nav.bookings', perm: 'bookings.view' },
    { href: '/admin/consultations', key: 'nav.consultations', perm: 'consultations.view' },
    { href: '/admin/chat', key: 'nav.chat', perm: 'clients.view', badge: 'chat' },
    { href: '/admin/calls', key: 'nav.calls', perm: 'calls.view' },
    { href: '/admin/clients', key: 'nav.clients', perm: 'clients.view' },
    { href: '/admin/reviews', key: 'nav.reviews', perm: 'reviews.manage' },
    { href: '/admin/nps', key: 'nav.nps', perm: 'reviews.manage' },
  ] },
  // Loyalty & offers: everything that gives a client a price break or a perk.
  { heading: 'nav.group.loyalty', icon: 'loyalty', items: [
    { href: '/admin/discounts', key: 'nav.discounts', perm: 'discounts.manage' },
    { href: '/admin/promotions', key: 'nav.promotions', perm: 'discounts.manage' },
    { href: '/admin/rewards', key: 'nav.rewards', perm: 'rewards.view' },
    { href: '/admin/membership', key: 'nav.membership', perm: 'discounts.manage' },
    { href: '/admin/gift-vouchers', key: 'nav.gift', perm: 'finance.view' },
  ] },
  // Catalogue: what you sell — services and retail products.
  { heading: 'nav.group.catalogue', icon: 'catalogue', items: [
    { href: '/admin/services', key: 'nav.services', perm: 'settings.manage' },
    { href: '/admin/products', key: 'nav.products', perm: 'settings.manage' },
  ] },
  // Website: the public-facing content and pages.
  { heading: 'nav.group.website', icon: 'website', items: [
    { href: '/admin/pages', key: 'nav.pages', perm: 'settings.manage' },
    { href: '/admin/blocks', key: 'nav.blocks', perm: 'settings.manage' },
    { href: '/admin/journal', key: 'nav.journal', perm: 'settings.manage' },
    { href: '/admin/media', key: 'nav.media', perm: 'settings.manage' },
    { href: '/admin/academy', key: 'nav.academy', perm: 'settings.manage' },
    { href: '/admin/gallery', key: 'nav.gallery', perm: 'settings.manage' },
    { href: '/admin/careers', key: 'nav.careers', perm: 'settings.manage' },
  ] },
  { heading: 'nav.group.operations', icon: 'operations', items: [
    { href: '/admin/schedule', key: 'nav.schedule', perm: 'schedule.manage' },
    { href: '/admin/inventory', key: 'nav.inventory', perm: 'inventory.view' },
    { href: '/admin/reorder', key: 'nav.reorder', perm: 'inventory.view' },
    { href: '/admin/suppliers', key: 'nav.suppliers', perm: 'suppliers.view' },
    { href: '/admin/sops', key: 'nav.sops', perm: 'sop.manage' },
    { href: '/admin/consent', key: 'nav.consent', perm: 'settings.manage' },
    { href: '/admin/day-close', key: 'nav.dayclose', perm: 'dayclose.run' },
  ] },
  { heading: 'nav.group.marketing', icon: 'marketing', items: [
    { href: '/admin/marketing', key: 'nav.marketing', exact: true, perm: 'campaigns.view' },
    { href: '/admin/marketing/performance', key: 'nav.performance', perm: 'campaigns.view' },
    { href: '/admin/marketing/campaigns', key: 'nav.campaigns', perm: 'campaigns.view' },
    { href: '/admin/marketing/audiences', key: 'nav.audiences', perm: 'campaigns.view' },
    { href: '/admin/marketing/email', key: 'nav.email', perm: 'campaigns.view' },
    { href: '/admin/marketing/templates', key: 'nav.templates', perm: 'campaigns.view' },
    { href: '/admin/automations', key: 'nav.automations', perm: 'automations.view' },
    { href: '/admin/marketing/ab', key: 'nav.ab', perm: 'campaigns.view' },
    { href: '/admin/marketing/insights', key: 'nav.insights', perm: 'campaigns.view' },
    { href: '/admin/brand', key: 'nav.brand', perm: 'settings.manage' },
    { href: '/admin/marketing/connections', key: 'nav.connections', perm: 'settings.manage' },
    { href: '/admin/qr', key: 'nav.qr', perm: 'settings.manage' },
  ] },
  { heading: 'nav.group.finance', icon: 'finance', items: [
    { href: '/admin/pos', key: 'nav.pos', perm: 'pos.use' },
    { href: '/admin/orders', key: 'nav.orders', perm: 'finance.view' },
    { href: '/admin/cashflow', key: 'nav.cashflow', perm: 'finance.view' },
    { href: '/admin/reports', key: 'nav.reports', perm: 'finance.view' },
  ] },
  { heading: 'nav.group.admin', icon: 'admin', items: [
    { href: '/admin/go-live', key: 'nav.golive', perm: 'settings.manage' },
    { href: '/admin/status', key: 'nav.status', perm: 'platform.status' },
    { href: '/admin/build', key: 'nav.build', perm: 'build.view' },
    { href: '/admin/staff', key: 'nav.staff', perm: 'staff.view' },
    { href: '/admin/security', key: 'nav.security', perm: 'security.manage' },
    { href: '/admin/activity', key: 'nav.activity', perm: 'staff.view' },
    { href: '/admin/site', key: 'nav.site', perm: 'settings.manage' },
    { href: '/admin/locations', key: 'nav.locations', perm: 'settings.manage' },
    { href: '/admin/seo', key: 'nav.seo', perm: 'settings.manage' },
    { href: '/admin/redirects', key: 'nav.redirects', perm: 'settings.manage' },
    { href: '/admin/integrations', key: 'nav.integrations', perm: 'settings.manage' },
    { href: '/admin/settings', key: 'nav.settings', perm: 'settings.manage' },
  ] },
];

// Restrained group-level iconography: a single line glyph per section so the
// collapsed sidebar is scannable at a glance. Inherits currentColor; no per-item
// icons (kept deliberately light, per the brief).
function GroupIcon({ name }: { name?: GroupIconKey }) {
  if (!name) return null;
  const p: Record<GroupIconKey, React.ReactNode> = {
    today: <><circle cx="8" cy="8" r="6" /><path d="M8 4.5V8l2.5 1.5" /></>,
    clients: <><circle cx="8" cy="5.5" r="2.5" /><path d="M3.5 13c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" /></>,
    loyalty: <><path d="M8.5 2.5H13V7l-6 6-4.5-4.5 6-6Z" /><circle cx="10.5" cy="5" r="0.9" /></>,
    catalogue: <><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="0.8" /><rect x="9" y="2.5" width="4.5" height="4.5" rx="0.8" /><rect x="2.5" y="9" width="4.5" height="4.5" rx="0.8" /><rect x="9" y="9" width="4.5" height="4.5" rx="0.8" /></>,
    website: <><rect x="2.5" y="3" width="11" height="10" rx="1.2" /><path d="M2.5 6h11" /><circle cx="4.5" cy="4.5" r="0.4" /></>,
    operations: <><circle cx="8" cy="8" r="2.2" /><path d="M8 1.8v1.8M8 12.4v1.8M1.8 8h1.8M12.4 8h1.8M3.6 3.6l1.3 1.3M11.1 11.1l1.3 1.3M12.4 3.6l-1.3 1.3M4.9 11.1l-1.3 1.3" /></>,
    marketing: <><path d="M3 6.5 11 3v10L3 9.5V6.5Z" /><path d="M3 6.5H2v3h1M5 10v2.5" /></>,
    finance: <><circle cx="8" cy="8" r="6" /><path d="M9.5 6c-.4-.6-1.1-1-2-1-1.2 0-2 .7-2 1.6 0 2 4 1 4 3 0 .9-.9 1.6-2 1.6-.9 0-1.7-.4-2.1-1" /></>,
    admin: <><path d="M8 1.8 13 4v3.5c0 3-2 5-5 6.7-3-1.7-5-3.7-5-6.7V4l5-2.2Z" /></>,
  };
  return (
    <svg viewBox="0 0 16 16" aria-hidden width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      {p[name]}
    </svg>
  );
}

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
  const permitted = (n: NavItem) => !n.perm || allowed.has(n.perm);
  const groups = navGroups
    .map((g) => ({ heading: g.heading, icon: g.icon, items: g.items.filter(permitted) }))
    .filter((g) => g.items.length > 0);
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
  const [chatUnread, setChatUnread] = useState(0);
  const canApproveTimeOff = allowed.has('schedule.manage');
  useEffect(() => {
    let on = true;
    const load = () => {
      // Don't poll the DB when the tab is in the background (idle admin tabs).
      if (typeof document !== 'undefined' && document.hidden) return;
      fetch('/api/admin/badges')
        .then((r) => r.json())
        .then((j) => { if (on && j?.ok) { setPendingTimeOff(j.pendingTimeOff || 0); setOpenTasks(j.openTasks || 0); setChatUnread(j.chatUnread || 0); } })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 45000); // refresh badges (paused when tab hidden)
    const onVis = () => { if (!document.hidden) load(); }; // catch up on return
    document.addEventListener('visibilitychange', onVis);
    return () => { on = false; clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  const badgeCount = (badge?: string) =>
    badge === 'timeoff' ? (canApproveTimeOff ? pendingTimeOff : 0) : badge === 'tasks' ? openTasks : badge === 'chat' ? chatUnread : 0;

  // Collapsible sidebar sections (desktop). Collapsed by default; the section
  // containing the current page opens automatically so you can see where you are.
  const isActive = (n: NavItem) => (n.exact ? pathname === n.href : pathname.startsWith(n.href));
  const groupKey = (g: { heading?: string }, gi: number) => g.heading ?? `g${gi}`;
  const groupBadge = (items: NavItem[]) => items.reduce((s, n) => s + badgeCount(n.badge), 0);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const s = new Set<string>();
    groups.forEach((g, gi) => { if (g.items.some(isActive)) s.add(groupKey(g, gi)); });
    return s;
  });
  const toggleGroup = (k: string) => setOpenGroups((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  // While a guided tour is running, expand every nav section so the tour can
  // spotlight items that would otherwise be hidden inside a collapsed group.
  const groupKeysRef = useRef<string[]>([]);
  groupKeysRef.current = groups.map((g, gi) => groupKey(g, gi));
  useEffect(() => {
    const onTour = (e: Event) => { if ((e as CustomEvent).detail) setOpenGroups(new Set(groupKeysRef.current)); };
    window.addEventListener('kc-tour', onTour);
    return () => window.removeEventListener('kc-tour', onTour);
  }, []);

  // Mobile menu drawer (the desktop sidebar is hidden on small screens).
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { setMobileOpen(false); }, [pathname]); // close on navigation

  const renderLink = (n: NavItem) => (
    <Link
      key={n.href}
      href={n.href}
      data-tour={n.key}
      className={`flex items-center justify-between gap-2 whitespace-nowrap rounded-[var(--radius-sm)] px-4 py-2.5 text-sm transition-colors ${
        isActive(n) ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-bone)]'
      }`}
    >
      <span>{t(n.key)}</span>
      {badgeCount(n.badge) > 0 && (
        <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[0.65rem] font-semibold text-amber-950">{badgeCount(n.badge)}</span>
      )}
    </Link>
  );

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
          <div data-tour="admin-search"><GlobalSearch placeholder={t('shell.search')} /></div>

          {/* Mobile: a menu button opening a full grouped drawer (incl. account). */}
          <div className="lg:hidden">
            <button
              onClick={() => setMobileOpen((o) => !o)}
              aria-expanded={mobileOpen}
              className="mt-2 flex w-full items-center justify-between rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--color-ink)]"
            >
              <span>{t('shell.menu')}</span>
              <span aria-hidden className="text-lg leading-none">{mobileOpen ? '✕' : '☰'}</span>
            </button>
            {mobileOpen && (
              <div className="mt-2 max-h-[72vh] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-2">
                {groups.map((g, gi) => (
                  <div key={groupKey(g, gi)} className="mb-2">
                    {g.heading && <p className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-stone-soft)]"><GroupIcon name={g.icon} />{t(g.heading)}</p>}
                    <div className="flex flex-col gap-0.5">{g.items.map(renderLink)}</div>
                  </div>
                ))}
                {/* Account: language · profile · sign out */}
                <div className="mt-2 border-t border-[var(--color-line)] px-2 pt-3">
                  <label className="mb-3 block">
                    <span className="mb-1 block text-[0.65rem] uppercase tracking-[0.14em] text-[var(--color-stone)]">{t('shell.language')}</span>
                    <select value={locale} onChange={(e) => changeLanguage(e.target.value as Locale)} className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm outline-none focus:border-[var(--color-gold)]">
                      {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_LABELS[l]}</option>)}
                    </select>
                  </label>
                  {user && <p className="text-xs text-[var(--color-stone)]">{user}</p>}
                  <div className="mt-2 flex items-center gap-3">
                    <Link href="/admin/profile" className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">{t('shell.profile')}</Link>
                    <span className="text-[var(--color-line)]">·</span>
                    <button onClick={signOut} className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">{t('shell.signOut')}</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Desktop: collapsible sections (collapsed by default) */}
          <nav data-tour="admin-nav" className="hidden flex-col gap-0.5 lg:flex">
            {groups.map((g, gi) => {
              const key = groupKey(g, gi);
              const open = openGroups.has(key);
              const pending = groupBadge(g.items);
              return (
                <div key={key}>
                  <button
                    onClick={() => toggleGroup(key)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-4 pb-1 pt-4 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-stone-soft)] transition-colors hover:text-[var(--color-stone)]"
                  >
                    <span className="text-[0.7rem] leading-none text-[var(--color-stone)]">{open ? '▾' : '▸'}</span>
                    <GroupIcon name={g.icon} />
                    <span className="flex-1 text-left">{g.heading ? t(g.heading) : ''}</span>
                    {!open && pending > 0 && (
                      <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[0.6rem] font-semibold text-amber-950">{pending}</span>
                    )}
                  </button>
                  {open && <div className="flex flex-col gap-0.5">{g.items.map(renderLink)}</div>}
                </div>
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
        <main className="flex-1 p-5 md:p-8 lg:p-10">
          {allowed.has('dayclose.run') && <CloseDownReminder />}
          {children}
        </main>
        {allowed.has('build.view') && <ReportProblem />}
      </div>
      <GuideHost />
    </I18nProvider>
  );
}
