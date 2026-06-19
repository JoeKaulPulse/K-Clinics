'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { KMark, ClinicsWordmark } from '@/components/brand/marks';
import { site } from '@/lib/site';
import { GlobalSearch } from '@/components/admin/GlobalSearch';
import { NotificationBell } from '@/components/admin/NotificationBell';
import { TeamChatProvider } from '@/components/admin/teamchat/TeamChatProvider';
import { ChatLauncher } from '@/components/admin/teamchat/ChatLauncher';
import { ChatDock } from '@/components/admin/teamchat/ChatDock';
import { GuideHost } from '@/components/guide/GuideHost';
import { CloseDownReminder } from '@/components/admin/CloseDownReminder';
import { ReportProblem } from '@/components/admin/ReportProblem';
import { I18nProvider } from '@/components/i18n/I18nProvider';
import { translator, isLocale, LOCALES, LOCALE_LABELS, DEFAULT_LOCALE, type Locale } from '@/lib/i18n';
import { navGroups, type NavItem, type GroupIconKey } from '@/lib/admin-nav';

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
    academy: <><path d="M8 2.4 14.6 5.4 8 8.4 1.4 5.4 8 2.4Z" /><path d="M4.6 6.6V9.4c0 1 1.5 1.8 3.4 1.8s3.4-.8 3.4-1.8V6.6" /><path d="M14.6 5.4v3.1" /></>,
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

  // Flattened, permission-filtered page index handed to global search so the
  // sidebar's destinations are themselves searchable ("Go to" results).
  const navPages = groups.flatMap((g) =>
    g.items.map((n) => ({ href: n.href, label: t(n.key), group: g.heading ? t(g.heading) : '', keywords: n.keywords || '' })),
  );

  // Sidebar badges — a single lightweight request per shell mount.
  const [pendingTimeOff, setPendingTimeOff] = useState(0);
  const [openTasks, setOpenTasks] = useState(0);
  const [chatUnread, setChatUnread] = useState(0);
  const [teamChatUnread, setTeamChatUnread] = useState(0);
  const canApproveTimeOff = allowed.has('schedule.manage');
  useEffect(() => {
    let on = true;
    const load = () => {
      // Don't poll the DB when the tab is in the background (idle admin tabs).
      if (typeof document !== 'undefined' && document.hidden) return;
      fetch('/api/admin/badges')
        .then((r) => r.json())
        .then((j) => { if (on && j?.ok) { setPendingTimeOff(j.pendingTimeOff || 0); setOpenTasks(j.openTasks || 0); setChatUnread(j.chatUnread || 0); setTeamChatUnread(j.teamChatUnread || 0); } })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 45000); // refresh badges (paused when tab hidden)
    const onVis = () => { if (!document.hidden) load(); }; // catch up on return
    document.addEventListener('visibilitychange', onVis);
    return () => { on = false; clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  const badgeCount = (badge?: string) =>
    badge === 'timeoff' ? (canApproveTimeOff ? pendingTimeOff : 0) : badge === 'tasks' ? openTasks : badge === 'chat' ? chatUnread : badge === 'teamchat' ? teamChatUnread : 0;

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
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  // Top-bar profile dropdown (account · language · sign out).
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setProfileOpen(false); }, [pathname]); // close on navigation
  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setProfileOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, []);
  // Initials for the avatar, derived from the signed-in email local-part.
  const initials = (user || '').replace(/@.*/, '').split(/[.\-_ ]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('') || 'K';

  const renderLink = (n: NavItem) => (
    <Link
      key={n.href}
      href={n.href}
      data-tour={n.key}
      aria-current={isActive(n) ? 'page' : undefined}
      className={`flex min-h-[2.75rem] items-center justify-between gap-2 whitespace-nowrap rounded-[var(--radius-sm)] px-4 py-2.5 text-sm transition-[background-color,color,transform] duration-150 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)] motion-reduce:transition-none motion-reduce:active:scale-100 lg:min-h-0 ${
        isActive(n)
          ? 'bg-[var(--color-ink)] font-medium text-[var(--color-porcelain)]'
          : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-bone)] hover:text-[var(--color-ink)]'
      }`}
    >
      <span className="truncate">{t(n.key)}</span>
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

  // Brand lockup — shared by the desktop sidebar and the mobile drawer header.
  const brand = (
    <div className="inline-flex flex-col items-center text-[var(--color-ink)]">
      <span className="block h-9 w-[1.35rem]"><KMark /></span>
      <span className="mt-3 block h-[0.62rem] w-[6.75rem]"><ClinicsWordmark /></span>
      <p className="mt-3 pl-[0.3em] text-center text-[0.66rem] font-medium uppercase tracking-[0.3em] text-[var(--color-stone)]">
        {locationLabel}
        <span className="text-[var(--color-stone)]"> · CRM</span>
      </p>
    </div>
  );

  // Collapsible grouped navigation — shared by the desktop sidebar and the
  // mobile drawer so they can never drift.
  const navTree = (
    <>
      {groups.map((g, gi) => {
        const key = groupKey(g, gi);
        const open = openGroups.has(key);
        const pending = groupBadge(g.items);
        return (
          <div key={key}>
            <button
              onClick={() => toggleGroup(key)}
              aria-expanded={open}
              className="flex w-full cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-4 pb-1 pt-4 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-stone)] transition-colors hover:text-[var(--color-stone)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]"
            >
              <svg
                viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden
                className={`shrink-0 text-[var(--color-stone)] transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-90' : ''}`}
              >
                <path d="m6 3.5 4.5 4.5L6 12.5" />
              </svg>
              <GroupIcon name={g.icon} />
              <span className="flex-1 text-left">{g.heading ? t(g.heading) : ''}</span>
              {!open && pending > 0 && (
                <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[0.6rem] font-semibold text-amber-950">{pending}</span>
              )}
            </button>
            {/* Animated accordion: grid-rows 0fr→1fr is transform-safe (no JS
                measuring, no layout thrash) and collapses both ways smoothly. */}
            <div className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`} inert={open ? undefined : true}>
              <div className="flex flex-col gap-0.5 overflow-hidden">{g.items.map(renderLink)}</div>
            </div>
          </div>
        );
      })}
    </>
  );

  return (
    <I18nProvider locale={locale}>
      <TeamChatProvider>
      <div className="flex min-h-screen bg-[var(--color-bone)]">
        {/* Desktop sidebar — navigation only; account moved to the top bar. */}
        <aside className="hidden shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-porcelain)] lg:flex lg:w-64">
          <div className="flex justify-center px-6 pb-5 pt-6">{brand}</div>
          <nav data-tour="admin-nav" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-4 pb-6">{navTree}</nav>
        </aside>

        {/* Mobile drawer — off-canvas, opened from the top-bar hamburger. */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
            <div className="kc-fade-in absolute inset-0 bg-[var(--color-ink)]/45 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <aside className="kc-slide-in-left absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col bg-[var(--color-porcelain)] shadow-[var(--shadow-lift)]">
              <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-4">
                {brand}
                <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-stone)] transition-colors hover:bg-[var(--color-bone)] hover:text-[var(--color-ink)]">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="m3 3 10 10M13 3 3 13" /></svg>
                </button>
              </div>
              <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-6">{navTree}</nav>
            </aside>
          </div>
        )}

        {/* Main column — sticky top bar (search · notifications · profile). */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-[var(--color-line)] bg-[var(--color-porcelain)]/85 px-5 backdrop-blur md:gap-3 md:px-8 lg:px-10">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label={t('shell.menu')}
              aria-expanded={mobileOpen}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-ink)] transition-colors hover:bg-[var(--color-bone)] lg:hidden"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M3 5h14M3 10h14M3 15h14" /></svg>
            </button>
            <span className="block h-6 w-[0.9rem] shrink-0 text-[var(--color-ink)] lg:hidden"><KMark /></span>
            <div data-tour="admin-search" className="min-w-0 flex-1"><div className="max-w-xl"><GlobalSearch placeholder={t('shell.search')} pages={navPages} /></div></div>
            <div className="flex shrink-0 items-center gap-1 md:gap-2">
              <ChatLauncher />
              <NotificationBell />
              <div ref={profileRef} className="relative">
                <button
                  onClick={() => setProfileOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={profileOpen}
                  className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-[var(--color-bone)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)] md:pr-2.5"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-ink)] text-xs font-semibold text-[var(--color-porcelain)]">{initials}</span>
                  <span className="hidden max-w-[10rem] truncate text-sm text-[var(--color-ink-soft)] md:block">{user}</span>
                  <svg className={`hidden text-[var(--color-stone)] transition-transform md:block ${profileOpen ? 'rotate-180' : ''}`} width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m4 6 4 4 4-4" /></svg>
                </button>
                {profileOpen && (
                  <div role="menu" className="kc-pop absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white shadow-[var(--shadow-lift)]">
                    <div className="border-b border-[var(--color-line)] bg-[var(--color-bone)]/60 px-4 py-3">
                      <p className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-stone)]">Signed in as</p>
                      {user && <p className="mt-0.5 truncate text-sm font-medium text-[var(--color-ink)]">{user}</p>}
                    </div>
                    <Link href="/admin/profile" role="menuitem" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-bone)]">
                      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-[var(--color-stone)]"><circle cx="8" cy="5.5" r="2.5" /><path d="M3.5 13c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" /></svg>
                      {t('shell.profile')}
                    </Link>
                    <label className="block px-4 py-2.5">
                      <span className="mb-1 block text-[0.6rem] uppercase tracking-[0.14em] text-[var(--color-stone)]">{t('shell.language')}</span>
                      <select value={locale} onChange={(e) => changeLanguage(e.target.value as Locale)} className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm outline-none focus:border-[var(--color-gold)]">
                        {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_LABELS[l]}</option>)}
                      </select>
                    </label>
                    <button onClick={signOut} role="menuitem" className="flex w-full items-center gap-2.5 border-t border-[var(--color-line)] px-4 py-2.5 text-left text-sm text-[#b23b3b] transition-colors hover:bg-[color-mix(in_oklab,#b23b3b_10%,transparent)]">
                      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 2.5H3.5v11H6M10.5 11l3-3-3-3M13 8H6.5" /></svg>
                      {t('shell.signOut')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>
          {/* key={pathname} restarts the entrance on every navigation — a short
              fade-up that makes page changes feel composed rather than abrupt. */}
          <main key={pathname} className="kc-page-enter flex-1 p-5 md:p-8 lg:p-10">
            {allowed.has('dayclose.run') && <CloseDownReminder />}
            {children}
          </main>
        </div>
        {allowed.has('build.view') && <ReportProblem />}
      </div>
      <ChatDock />
      <GuideHost />
      </TeamChatProvider>
    </I18nProvider>
  );
}
