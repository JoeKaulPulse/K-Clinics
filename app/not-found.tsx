import { Button, ArrowIcon } from '@/components/ui/Button';
import { GenerativeArt } from '@/components/ui/GenerativeArt';
import { Header } from '@/components/layout/Header';
import { getSiteConfig } from '@/lib/site-config';

export default async function NotFound() {
  const config = await getSiteConfig();
  return (
    <>
      <Header config={config} />
      <section className="relative grid min-h-[80svh] place-items-center overflow-hidden">
        <GenerativeArt from="#2a2420" to="#4a3f37" className="absolute inset-0" />
        <div className="container-narrow relative z-10 text-center text-[var(--color-porcelain)]">
          <p className="eyebrow mb-5 text-[var(--color-gold-soft)]">Page not found</p>
          <h1 className="text-hero">404</h1>
          <p className="mx-auto mt-6 max-w-md text-lg text-[color-mix(in_oklab,var(--color-porcelain)_76%,transparent)]">
            The page you are looking for has moved, or perhaps never existed. Let us guide you back to something beautiful.
          </p>
          <div className="mt-9 flex justify-center gap-3">
            <Button href="/">Return home <ArrowIcon /></Button>
            <Button href="/treatments" variant="outline">Explore treatments</Button>
          </div>
          {/* This page renders without the main nav, so offer the popular routes. */}
          <div className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-[color-mix(in_oklab,var(--color-porcelain)_72%,transparent)]">
            {[
              { label: 'Book an appointment', href: '/book' },
              { label: 'Pricing', href: '/pricing' },
              { label: 'Dentistry', href: '/dentistry' },
              { label: 'Contact & find us', href: '/contact' },
              { label: 'FAQ', href: '/faq' },
            ].map((l) => (
              <a key={l.href} href={l.href} className="underline-offset-4 transition-colors hover:text-[var(--color-gold-soft)] hover:underline">{l.label}</a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
