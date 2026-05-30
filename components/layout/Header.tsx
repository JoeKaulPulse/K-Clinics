'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { primaryNav } from '@/lib/nav';
import { site } from '@/lib/site';
import { getTreatment } from '@/lib/treatments';
import { Logo } from '@/components/brand/Logo';
import { Button, ArrowIcon } from '@/components/ui/Button';
import { GenerativeArt } from '@/components/ui/GenerativeArt';

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobile(false);
    setOpen(null);
    setPreview(null);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobile ? 'hidden' : '';
  }, [mobile]);

  // Over the (dark) hero at the top of every page we use light text;
  // once scrolled, the bar frosts to cream and we switch to dark text.
  const light = !scrolled && !mobile;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-700 [transition-timing-function:var(--ease-lux)] ${
        scrolled
          ? 'border-b border-[var(--color-line)] bg-[color-mix(in_oklab,var(--color-porcelain)_82%,transparent)] backdrop-blur-xl'
          : 'border-b border-transparent'
      }`}
      onMouseLeave={() => setOpen(null)}
    >
      <div className="container-lux flex h-[var(--header-h,5.25rem)] items-center justify-between">
        <Link href="/" className="relative z-10 shrink-0" aria-label={`${site.name} home`}>
          <Logo mono={light} className={light ? 'text-[var(--color-porcelain)]' : ''} />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {primaryNav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <div key={item.label} onMouseEnter={() => setOpen(item.columns ? item.label : null)}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative inline-flex items-center gap-1 rounded-full px-4 py-2 text-[0.95rem] font-medium transition-colors ${
                    light
                      ? 'text-[color-mix(in_oklab,var(--color-porcelain)_88%,transparent)] hover:text-[var(--color-porcelain)]'
                      : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
                  }`}
                >
                  {item.label}
                  {item.columns && (
                    <svg viewBox="0 0 10 6" className={`h-1.5 w-2.5 transition-transform duration-300 ${open === item.label ? 'rotate-180' : ''}`} aria-hidden>
                      <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  )}
                  {active && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-x-3 -bottom-0.5 h-[1.5px] rounded-full bg-[var(--color-gold)]"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </Link>
              </div>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <a
            href={site.phoneHref}
            className={`link-underline text-sm font-medium transition-colors ${
              light ? 'text-[color-mix(in_oklab,var(--color-porcelain)_88%,transparent)]' : 'text-[var(--color-ink-soft)]'
            }`}
          >
            {site.phone}
          </a>
          <Button href={site.booking.path} size="md" variant={light ? 'gold' : 'ink'}>
            Book Now <ArrowIcon />
          </Button>
        </div>

        {/* Mobile toggle */}
        <button
          className={`relative z-10 grid h-11 w-11 place-items-center rounded-full lg:hidden ${
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
                  return (
                    <div
                      key={item.label}
                      className="grid gap-x-10 gap-y-8"
                      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr)) 18rem` }}
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

                      {/* Hover preview pane */}
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
                              <GenerativeArt from={previewT.gradient[0]} to={previewT.gradient[1]} className="h-full w-full" />
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
            className="fixed inset-0 top-0 z-0 h-[100dvh] overflow-y-auto bg-[var(--color-porcelain)] px-6 pb-12 pt-24 lg:hidden"
          >
            <nav className="flex flex-col divide-y divide-[var(--color-line)]" aria-label="Mobile">
              {primaryNav.map((item, idx) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + idx * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  className="py-5"
                >
                  <Link href={item.href} className="font-[family-name:var(--font-display)] text-3xl">
                    {item.label}
                  </Link>
                  {item.columns && (
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                      {item.columns.flatMap((c) => c.links).map((l) => (
                        <Link key={l.href} href={l.href} className="text-sm text-[var(--color-stone)]">
                          {l.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </nav>
            <div className="mt-8 flex flex-col gap-3">
              <Button href={site.booking.path} size="lg" className="w-full">
                Book online <ArrowIcon />
              </Button>
              <Link href="/consultation" className="mt-1 text-center text-sm font-medium text-[var(--color-gold)] underline-offset-4 hover:underline">
                Or request a free consultation
              </Link>
              <a href={site.phoneHref} className="mt-2 text-center text-sm font-medium">
                {site.phone}
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
