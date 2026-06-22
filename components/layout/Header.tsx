'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import type { SiteConfig } from '@/lib/site-config';
import { getTreatment } from '@/lib/treatments';
import { Logo } from '@/components/brand/Logo';
import { Button, ArrowIcon } from '@/components/ui/Button';
import { GenerativeArt } from '@/components/ui/GenerativeArt';
import { MediaArt } from '@/components/ui/MediaArt';
import { treatmentImage } from '@/lib/treatment-images';
import { AccountMenu } from '@/components/layout/AccountMenu';
import { SiteSearch } from '@/components/layout/SiteSearch';

export function Header({ config }: { config: SiteConfig }) {
  const { nav, booking, name, phone, phoneHref } = config;
  const primaryNav = nav.primary;
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const pathname = usePathname();

  // BLD-237 — keyboard + screen-reader access to the desktop mega-menu. The
  // chevron is a real toggle button (aria-haspopup/expanded/controls); opening
  // from it moves focus into the panel, Escape closes and restores focus to the
  // trigger, and Tab-ing out of the header closes the menu.
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const focusPanelOnOpen = useRef(false);
  const menuId = (label: string) => `mega-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  function toggleMenu(label: string) {
    setOpen((prev) => {
      const next = prev === label ? null : label;
      focusPanelOnOpen.current = Boolean(next);
      return next;
    });
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // When opened via the toggle, move focus to the first link in the panel.
  useEffect(() => {
    if (open && focusPanelOnOpen.current) {
      focusPanelOnOpen.current = false;
      panelRef.current?.querySelector<HTMLAnchorElement>('a')?.focus();
    }
  }, [open]);

  // Escape closes the open mega-menu and returns focus to its trigger.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { const t = triggerRefs.current[open]; setOpen(null); t?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    setMobile(false);
    setOpen(null);
    setPreview(null);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobile ? 'hidden' : '';
  }, [mobile]);

  // Over the dark hero at the top of every page (incl. the home hero) we use
  // light text; once scrolled, the bar frosts to cream and switches to dark text.
  const light = !scrolled && !mobile;

  return (
    <header
      className={`fixed inset-x-0 top-[var(--ann-h,0px)] z-50 transition-all duration-700 [transition-timing-function:var(--ease-lux)] ${
        scrolled
          ? 'border-b border-[var(--color-line)] bg-[color-mix(in_oklab,var(--color-porcelain)_92%,transparent)] backdrop-blur-sm'
          : 'border-b border-transparent'
      }`}
      onMouseLeave={() => setOpen(null)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(null); }}
    >
      <div className="container-lux flex h-[var(--header-h,5.25rem)] items-center justify-between">
        <Link href="/" className="relative z-10 shrink-0" aria-label={`${name} home`}>
          <Logo mono={light} className={light ? 'text-[var(--color-porcelain)]' : ''} />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 xl:flex" aria-label="Primary">
          {primaryNav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const hasMenu = !!item.columns;
            const isOpen = open === item.label;
            const linkColour = light
              ? 'text-[color-mix(in_oklab,var(--color-porcelain)_88%,transparent)] hover:text-[var(--color-porcelain)]'
              : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]';
            return (
              <div key={item.label} className="inline-flex items-center" onMouseEnter={() => setOpen(hasMenu ? item.label : null)}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative inline-flex items-center gap-1 rounded-full px-4 py-2 text-[0.95rem] font-medium transition-colors ${linkColour} ${hasMenu ? 'pr-2' : ''}`}
                >
                  {item.label}
                  {active && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-x-3 -bottom-0.5 h-[1.5px] rounded-full bg-[var(--color-gold)]"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </Link>
                {hasMenu && (
                  <button
                    type="button"
                    ref={(el) => { triggerRefs.current[item.label] = el; }}
                    onClick={() => toggleMenu(item.label)}
                    aria-haspopup="true"
                    aria-expanded={isOpen}
                    aria-controls={menuId(item.label)}
                    aria-label={`${isOpen ? 'Close' : 'Open'} ${item.label} menu`}
                    className={`-ml-1.5 grid h-8 w-8 place-items-center rounded-full transition-colors ${linkColour} hover:bg-[color-mix(in_oklab,var(--color-stone)_16%,transparent)]`}
                  >
                    <svg viewBox="0 0 10 6" className={`h-1.5 w-2.5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} aria-hidden>
                      <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 xl:flex">
          <Link href="/shop" className={`text-sm font-medium transition-colors hover:text-[var(--color-gold)] ${light ? 'text-[var(--color-porcelain)]' : 'text-[var(--color-ink)]'}`}>Shop</Link>
          <SiteSearch light={light} />
          <AccountMenu light={light} />
          <Button href={booking.path} size="md" variant={light ? 'gold' : 'ink'}>
            Book Now <ArrowIcon />
          </Button>
        </div>

        {/* Mobile toggle */}
        <button
          className={`relative z-10 grid h-11 w-11 place-items-center rounded-full xl:hidden ${
            light ? 'text-[var(--color-porcelain)]' : 'text-[var(--color-ink)]'
          }`}
          onClick={() => setMobile((m) => !m)}
          aria-label={mobile ? 'Close menu' : 'Open menu'}
          aria-expanded={mobile}
        >
          <span className="flex flex-col gap-[5px]">
            <span className={`h-[1.5px] w-6 bg-current transition-all duration-300 ${mobile ? 'translate-y-[6.5px] rotate-45' : ''}`} />
            <span className={`h-[1.5px] w-6 bg-current transition-all duration-300 ${mobile ? 'opacity-0' : ''}`} />
            <span className={`h-[1.5px] w-6 bg-current transition-all duration-300 ${mobile ? '-translate-y-[6.5px] -rotate-45' : ''}`} />
          </span>
        </button>
      </div>

      {/* Desktop mega-menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            key={open}
            ref={panelRef}
            id={menuId(open)}
            aria-label={`${open} menu`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-x-0 top-full hidden border-b border-[var(--color-line)] bg-[color-mix(in_oklab,var(--color-porcelain)_94%,transparent)] backdrop-blur-2xl lg:block"
          >
            <div className="container-lux py-9" onMouseLeave={() => setPreview(null)}>
              {primaryNav
                .filter((i) => i.label === open && i.columns)
                .map((item) => {
                  const cols = item.columns!.length;
                  const previewT = preview ? getTreatment(preview.replace(/^\//, '')) : null;
                  // Only treatment menus (Aesthetics/Dentistry) get the hover preview pane.
                  const isTreatmentMenu = item.columns!.some((col) => col.links.some((l) => getTreatment(l.href.replace(/^\//, ''))));
                  return (
                    <div
                      key={item.label}
                      className="grid gap-x-10 gap-y-8"
                      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))${isTreatmentMenu ? ' 18rem' : ''}` }}
                    >
                      {item.columns!.map((col) => (
                        <div key={col.heading}>
                          <p className="eyebrow mb-4">{col.heading}</p>
                          <ul className="space-y-1">
                            {col.links.map((l) => (
                              <li key={l.href}>
                                <Link
                                  href={l.href}
                                  onMouseEnter={() => setPreview(l.href)}
                                  className="group flex items-baseline justify-between gap-4 rounded-xl px-3 py-2.5 -mx-3 transition-colors hover:bg-[var(--color-bone)]"
                                >
                                  <span>
                                    <span className="block font-[family-name:var(--font-display)] text-lg leading-tight">{l.label}</span>
                                    {l.description && <span className="text-sm text-[var(--color-stone)]">{l.description}</span>}
                                  </span>
                                  <ArrowIcon className="mt-1 shrink-0 text-[var(--color-gold)] opacity-0 transition-opacity group-hover:opacity-100" />
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}

                      {/* Hover preview pane — treatment menus only */}
                      {isTreatmentMenu && (
                      <div className="relative hidden overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] xl:block">
                        <AnimatePresence mode="wait">
                          {previewT ? (
                            <motion.div
                              key={previewT.slug}
                              initial={{ opacity: 0, scale: 1.04 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                              className="absolute inset-0"
                            >
                              <MediaArt src={treatmentImage(previewT.slug)} from={previewT.gradient[0]} to={previewT.gradient[1]} alt={previewT.title} sizes="18rem" className="h-full w-full" />
                              <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(to_top,rgba(42,36,32,0.8),transparent)] p-5 pt-12 text-[var(--color-porcelain)]">
                                <p className="font-[family-name:var(--font-display)] text-xl">{previewT.title}</p>
                                <p className="mt-1 text-xs text-[color-mix(in_oklab,var(--color-porcelain)_80%,transparent)]">{previewT.tagline}</p>
                              </div>
                            </motion.div>
                          ) : (
                            <motion.div key="placeholder" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
                              <GenerativeArt from="#a98a6d" to="#2a2420" className="h-full w-full opacity-70" />
                              <div className="absolute inset-0 grid place-items-center p-6 text-center">
                                <p className="font-[family-name:var(--font-display)] text-lg text-[var(--color-porcelain)]">Hover a treatment to preview</p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 top-0 z-0 h-[100dvh] overflow-y-auto bg-[var(--color-porcelain)] px-6 pb-12 pt-24 xl:hidden"
          >
            <nav className="flex flex-col divide-y divide-[var(--color-line)]" aria-label="Mobile">
              {primaryNav.map((item, idx) => {
                const expanded = open === item.label;
                return (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + idx * 0.05, ease: [0.16, 1, 0.3, 1] }}
                    className="py-4"
                  >
                    {item.columns ? (
                      <>
                        <div className="flex w-full items-center justify-between">
                          <Link href={item.href} onClick={() => setMobile(false)} className="font-[family-name:var(--font-display)] text-2xl">
                            {item.label}
                          </Link>
                          <button
                            onClick={() => setOpen(expanded ? null : item.label)}
                            aria-expanded={expanded}
                            className="grid h-9 w-9 place-items-center text-[var(--color-stone)]"
                            aria-label={`${expanded ? 'Close' : 'Open'} ${item.label} submenu`}
                          >
                            <svg viewBox="0 0 24 24" className={`h-5 w-5 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </button>
                        </div>
                        {expanded && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 overflow-hidden">
                            {item.columns.flatMap((c) => c.links).map((l) => (
                              <Link key={l.href} href={l.href} onClick={() => setMobile(false)} className="text-sm text-[var(--color-stone)]">
                                {l.label}
                              </Link>
                            ))}
                          </motion.div>
                        )}
                      </>
                    ) : (
                      <Link href={item.href} onClick={() => setMobile(false)} className="block font-[family-name:var(--font-display)] text-2xl">
                        {item.label}
                      </Link>
                    )}
                  </motion.div>
                );
              })}
            </nav>
            <div className="mt-8 flex flex-col gap-3">
              <Button href={booking.path} size="lg" className="w-full">
                Book online <ArrowIcon />
              </Button>
              <Link
                href="/account"
                onClick={() => setMobile(false)}
                className="flex items-center justify-center gap-2 rounded-full border border-[var(--color-line)] px-6 py-3.5 text-sm font-medium text-[var(--color-ink-soft)] transition-colors hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
                  <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M5 19.5c1.6-3 4-4.5 7-4.5s5.4 1.5 7 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Sign in / My account
              </Link>
              <Link href="/consultation" className="mt-1 text-center text-sm font-medium text-[var(--color-gold)] underline-offset-4 hover:underline">
                Or request a free consultation
              </Link>
              <a href={phoneHref} className="mt-2 text-center text-sm font-medium">
                {phone}
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
