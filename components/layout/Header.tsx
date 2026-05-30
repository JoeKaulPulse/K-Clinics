'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { primaryNav } from '@/lib/nav';
import { site } from '@/lib/site';
import { Logo } from '@/components/brand/Logo';
import { Button, ArrowIcon } from '@/components/ui/Button';

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
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
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobile ? 'hidden' : '';
  }, [mobile]);

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
          <Logo />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {primaryNav.map((item) => (
            <div key={item.label} onMouseEnter={() => setOpen(item.columns ? item.label : null)}>
              <Link
                href={item.href}
                className="relative inline-flex items-center gap-1 rounded-full px-4 py-2 text-[0.95rem] font-medium text-[var(--color-ink-soft)] transition-colors hover:text-[var(--color-ink)]"
              >
                {item.label}
                {item.columns && (
                  <svg viewBox="0 0 10 6" className={`h-1.5 w-2.5 transition-transform duration-300 ${open === item.label ? 'rotate-180' : ''}`} aria-hidden>
                    <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                )}
              </Link>
            </div>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <a href={site.phoneHref} className="link-underline text-sm font-medium text-[var(--color-ink-soft)]">
            {site.phone}
          </a>
          <Button href={site.booking.treatwell} external size="md">
            Book Now <ArrowIcon />
          </Button>
        </div>

        {/* Mobile toggle */}
        <button
          className="relative z-10 grid h-11 w-11 place-items-center rounded-full lg:hidden"
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
            <div className="container-lux py-9">
              {primaryNav
                .filter((i) => i.label === open && i.columns)
                .map((item) => (
                  <div key={item.label} className="grid grid-cols-3 gap-x-10 gap-y-8">
                    {item.columns!.map((col) => (
                      <div key={col.heading}>
                        <p className="eyebrow mb-4">{col.heading}</p>
                        <ul className="space-y-1">
                          {col.links.map((l) => (
                            <li key={l.href}>
                              <Link
                                href={l.href}
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
                  </div>
                ))}
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
              <Button href={site.booking.treatwell} external size="lg" className="w-full">
                Book on Treatwell <ArrowIcon />
              </Button>
              <Button href={site.booking.fresha} external variant="outline" size="lg" className="w-full">
                Book on Fresha
              </Button>
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
