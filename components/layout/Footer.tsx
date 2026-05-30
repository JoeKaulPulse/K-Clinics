import Link from 'next/link';
import { site } from '@/lib/site';
import { footerNav } from '@/lib/nav';
import { Logo } from '@/components/brand/Logo';
import { KMark } from '@/components/brand/marks';
import { BookingButtons } from '@/components/booking/BookingButtons';
import { Aurora } from '@/components/ui/Aurora';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="surface-ink grain relative overflow-hidden">
      <Aurora />
      {/* Faint brand watermark */}
      <span aria-hidden className="pointer-events-none absolute -right-[4%] -top-[12%] z-0 hidden h-[150%] w-auto text-[var(--color-gold)] opacity-[0.05] md:block">
        <span className="block h-full w-auto"><KMark /></span>
      </span>
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
          <BookingButtons align="center" />
        </div>
      </div>

      {/* Link grid */}
      <div className="container-lux relative grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo mono className="text-[var(--color-porcelain)]" />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-[color-mix(in_oklab,var(--color-porcelain)_64%,transparent)]">
            {site.tagline}. A premium clinic in the heart of Clerkenwell, uniting advanced aesthetics and aesthetic dentistry.
          </p>
          <div className="mt-6 flex gap-3">
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
          </div>
        </div>

        {footerNav.map((col) => (
          <nav key={col.heading} aria-label={col.heading}>
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
      </div>

      {/* Contact + legal */}
      <div className="container-lux relative grid gap-6 border-t border-white/10 py-9 text-sm text-[color-mix(in_oklab,var(--color-porcelain)_60%,transparent)] md:grid-cols-3">
        <p>
          {site.address.street}, {site.address.locality}, {site.address.region} {site.address.postalCode}
        </p>
        <p className="md:text-center">
          <a href={site.phoneHref} className="hover:text-[var(--color-gold)]">{site.phone}</a>
          {' · '}
          <a href={site.emailHref} className="hover:text-[var(--color-gold)]">{site.email}</a>
        </p>
        <p className="md:text-right">© {year} {site.legalName}. All rights reserved.</p>
      </div>
    </footer>
  );
}
