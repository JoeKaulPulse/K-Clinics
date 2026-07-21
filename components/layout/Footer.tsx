import Link from 'next/link';
import type { SiteConfig } from '@/lib/site-config';
import { Logo } from '@/components/brand/Logo';
import { BookingButtons } from '@/components/booking/BookingButtons';
import { Aurora } from '@/components/ui/Aurora';
import { NewsletterForm } from '@/components/layout/NewsletterForm';
import { AccessBadges } from '@/components/ui/AccessBadges';
import { PaymentMarks } from '@/components/ui/PaymentMarks';
import { CookieSettingsLink } from '@/components/legal/CookieSettingsLink';

// Brand glyphs for the footer social links (inherit currentColor).
function SocialIcon({ name }: { name: string }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true } as const;
  switch (name) {
    case 'instagram':
      return (
        <svg {...common}>
          <path d="M12 2.2c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.21 15.58 2.2 15.2 2.2 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.21 8.8 2.2 12 2.2Zm0 1.8c-3.15 0-3.5.01-4.74.07-.9.04-1.39.19-1.71.32-.43.17-.74.37-1.06.69-.32.32-.52.63-.69 1.06-.13.32-.28.81-.32 1.71-.06 1.24-.07 1.59-.07 4.74s.01 3.5.07 4.74c.04.9.19 1.39.32 1.71.17.43.37.74.69 1.06.32.32.63.52 1.06.69.32.13.81.28 1.71.32 1.24.06 1.59.07 4.74.07s3.5-.01 4.74-.07c.9-.04 1.39-.19 1.71-.32.43-.17.74-.37 1.06-.69.32-.32.52-.63.69-1.06.13-.32.28-.81.32-1.71.06-1.24.07-1.59.07-4.74s-.01-3.5-.07-4.74c-.04-.9-.19-1.39-.32-1.71a2.85 2.85 0 0 0-.69-1.06 2.85 2.85 0 0 0-1.06-.69c-.32-.13-.81-.28-1.71-.32C15.5 4.01 15.15 4 12 4Zm0 3.06A4.94 4.94 0 1 1 12 16.94 4.94 4.94 0 0 1 12 7.06Zm0 1.8a3.14 3.14 0 1 0 0 6.28 3.14 3.14 0 0 0 0-6.28Zm5.14-3.2a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3Z" />
        </svg>
      );
    case 'facebook':
      return (
        <svg {...common}>
          <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.49-3.91 3.78-3.91 1.1 0 2.24.2 2.24.2v2.48h-1.26c-1.24 0-1.63.78-1.63 1.57v1.87h2.78l-.44 2.91h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg {...common}>
          <path d="M16.5 3c.3 2.1 1.5 3.45 3.5 3.6v2.42c-1.16.11-2.18-.27-3.36-.98v4.34c0 4.04-2.45 6.62-6.04 6.62-2.78 0-4.6-1.85-4.6-4.3 0-2.62 2.05-4.45 4.66-4.45.37 0 .73.04 1.08.11v2.6a2.1 2.1 0 0 0-1.05-.27c-1.06 0-1.86.78-1.86 1.95 0 1.13.84 1.92 1.92 1.92 1.27 0 2.13-.98 2.13-2.62V3h3.62Z" />
        </svg>
      );
    default:
      return <span className="text-xs uppercase">{name[0]}</span>;
  }
}

export function Footer({ config }: { config: SiteConfig }) {
  const { social, mapLink, address, phone, phoneHref, email, emailHref, legalName, companyNumber } = config;
  const footerNav = config.nav.footer;
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
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-[color-mix(in_oklab,var(--color-porcelain)_64%,transparent)]">
            Receive considered tips on skin, smile and aesthetics — plus new treatments, seasonal edits and member-only offers.
          </p>
          <div className="mt-5 max-w-sm">
            <NewsletterForm />
          </div>
          <div className="mt-7 flex gap-3">
            {Object.entries(social).map(([k, href]) => (
              <a
                key={k}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={k}
                className="grid h-10 w-10 place-items-center rounded-full border border-white/15 text-[color-mix(in_oklab,var(--color-porcelain)_80%,transparent)] transition-colors hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
              >
                <SocialIcon name={k} />
              </a>
            ))}
            <a
              href={mapLink}
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
            <a href={mapLink} target="_blank" rel="noopener noreferrer" className="block transition-colors hover:text-[var(--color-gold)]">
              {address.street}, {address.region} {address.postalCode}
            </a>
            <a href={phoneHref} className="block transition-colors hover:text-[var(--color-gold)]">{phone}</a>
            <a href={emailHref} className="block transition-colors hover:text-[var(--color-gold)]">{email}</a>
          </address>
          <AccessBadges className="mt-6" />
        </div>
      </div>

      {/* Payments + © */}
      <div className="container-lux relative flex flex-col items-center gap-5 border-t border-white/10 py-7 text-xs text-[color-mix(in_oklab,var(--color-porcelain)_75%,transparent)] md:flex-row md:justify-between">
        <PaymentMarks />
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link href="/info/website-privacy-terms" className="transition-colors hover:text-[var(--color-gold)]">Privacy Policy</Link>
          <span className="text-white/15">·</span>
          <CookieSettingsLink />
          <span className="hidden md:inline text-white/15">·</span>
          {/* ICO data-protection registration + UK trade mark — shown publicly for transparency/compliance (BLD-503). */}
          <p>© {year} {legalName}{companyNumber ? ` · Registered in England & Wales, company no. ${companyNumber}` : ''} · ICO reg. ZC153001 · Trade Mark No. UK00004210472. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
