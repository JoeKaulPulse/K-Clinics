import Link from 'next/link';
import { site } from '@/lib/site';
import { footerNav } from '@/lib/nav';
import { Logo } from '@/components/brand/Logo';
import { BookingButtons } from '@/components/booking/BookingButtons';
import { Aurora } from '@/components/ui/Aurora';
import { NewsletterForm } from '@/components/layout/NewsletterForm';
import { AccessBadges } from '@/components/ui/AccessBadges';
import { PaymentMarks } from '@/components/ui/PaymentMarks';
import { CookieSettingsLink } from '@/components/legal/CookieSettingsLink';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="surface-ink grain relative overflow-hidden">
      <Aurora />
      {/* CTA band */}
      <div className="container-lux relative border-b border-white/10 py-20 text-center md:py-28">
        <p className="eyebrow mb-5">Begin your transformation</p>
        <h2 className="text-display mx-auto max-w-3xl text-balance text-[var(--color-porcelain)]">
          Your most confident self is one appointment away.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-[color-mix(in_oklab,var(--color-porcelain)_72%,transparent)]">
          New clients enjoy 15% off their first visit, and every consultation is complimentary.
        </p>
        <div className="mt-9 flex justify-center">
          <BookingButtons align="center" consult />
        </div>
      </div>

      {/* Main grid: brand + newsletter · Discover · Connect · Policies · contact */}
      <div className="container-lux relative grid gap-x-8 gap-y-12 py-16 lg:grid-cols-12">
        {/* Brand + newsletter */}
        <div className="lg:col-span-4">
          <Logo mono size="footer" className="text-[var(--color-porcelain)]" />
          <p className="mt-4 text-sm uppercase tracking-[0.16em] text-[color-mix(in_oklab,var(--color-porcelain)_55%,transparent)]">United Kingdom</p>
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-[color-mix(in_oklab,var(--color-porcelain)_64%,transparent)]">
            Receive considered tips on skin, smile and aesthetics — plus new treatments, seasonal edits and member-only offers.
          </p>
          <div className="mt-5 max-w-sm">
            <NewsletterForm />
          </div>
          <div className="mt-7 flex gap-3">
            {Object.entries(site.social).map(([k, href]) => (
              <a
                key={k}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={k}
                className="grid h-10 w-10 place-items-center rounded-full border border-white/15 text-xs uppercase tracking-wide transition-colors hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
              >
                {k[0].toUpperCase()}
              </a>
            ))}
            <a
              href={site.mapLink}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Find us on the map"
              className="grid h-10 w-10 place-items-center rounded-full border border-white/15 transition-colors hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10z" /><circle cx="12" cy="11" r="2" /></svg>
            </a>
          </div>
        </div>

        {/* Link columns */}
        {footerNav.map((col) => (
          <nav key={col.heading} aria-label={col.heading} className="lg:col-span-2">
            <p className="eyebrow mb-5">{col.heading}</p>
            <ul className="space-y-1">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="inline-block py-1.5 text-sm text-[color-mix(in_oklab,var(--color-porcelain)_72%,transparent)] transition-colors hover:text-[var(--color-gold)]"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        {/* Contact / NAP block */}
        <div className="lg:col-span-2">
          <p className="eyebrow mb-5">City of London · Islington</p>
          <address className="space-y-3 text-sm not-italic text-[color-mix(in_oklab,var(--color-porcelain)_72%,transparent)]">
            <a href={site.mapLink} target="_blank" rel="noopener noreferrer" className="block transition-colors hover:text-[var(--color-gold)]">
              {site.address.street}, {site.address.region} {site.address.postalCode}
            </a>
            <a href={site.phoneHref} className="block transition-colors hover:text-[var(--color-gold)]">{site.phone}</a>
            <a href={site.emailHref} className="block transition-colors hover:text-[var(--color-gold)]">{site.email}</a>
          </address>
          <AccessBadges className="mt-6" />
        </div>
      </div>

      {/* Payments + © */}
      <div className="container-lux relative flex flex-col items-center gap-5 border-t border-white/10 py-7 text-xs text-[color-mix(in_oklab,var(--color-porcelain)_55%,transparent)] md:flex-row md:justify-between">
        <PaymentMarks />
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <CookieSettingsLink />
          <span className="hidden md:inline text-white/15">·</span>
          <p>© {year} {site.legalName}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
