import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal } from '@/components/motion/Reveal';
import { BookingButtons } from '@/components/booking/BookingButtons';
import { Button, ArrowIcon } from '@/components/ui/Button';
import { treatments, groupByGroup } from '@/lib/treatments';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Pricing — Aesthetics & Dentistry in London | K Clinics',
  description:
    'Transparent guide pricing for treatments at K Clinics, Islington, London. Laser, skin, body and dental treatments with complimentary consultations and 15% off your first visit.',
  path: '/pricing',
  keywords: ['aesthetic treatment prices London', 'laser hair removal cost London', 'veneers cost London', 'HIFU price'],
});

export default function PricingPage() {
  const groups = groupByGroup(treatments);
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Pricing', path: '/pricing' }])} />
      <PageHero
        eyebrow="Transparent pricing"
        title="Clarity, before you commit."
        lede="Guide prices to help you plan. Your exact, personalised pricing is confirmed at a complimentary consultation — where new clients also enjoy 15% off their first visit."
        gradient={['#3a2730', '#b08544']}
      >
        <BookingButtons />
      </PageHero>

      <section className="container-lux py-20 md:py-28">
        <div className="space-y-16">
          {Object.entries(groups).map(([group, list]) => (
            <Reveal key={group}>
              <div>
                <h2 className="text-title mb-6 border-b border-[var(--color-ink)] pb-4">{group}</h2>
                <ul className="divide-y divide-[var(--color-line)]">
                  {list.map((t) => (
                    <li key={t.slug}>
                      <Link
                        href={`/${t.slug}`}
                        className="group flex items-center justify-between gap-6 py-5 transition-colors hover:text-[var(--color-gold)]"
                      >
                        <span>
                          <span className="font-[family-name:var(--font-display)] text-xl">{t.title}</span>
                          <span className="mt-0.5 block text-sm text-[var(--color-stone)]">{t.tagline}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-3 text-right">
                          <span className="font-[family-name:var(--font-display)] text-lg">
                            {t.priceFrom?.startsWith('£') ? `from ${t.priceFrom}` : t.priceFrom ?? 'On consultation'}
                          </span>
                          <ArrowIcon className="opacity-0 transition-opacity group-hover:opacity-100" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <div className="mt-20 rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 text-center md:p-12">
            <p className="eyebrow mb-3">A note on pricing</p>
            <p className="mx-auto max-w-2xl text-lg text-[var(--color-stone)]">
              Because every treatment plan is bespoke, the figures above are starting guides. We believe in complete transparency — your full, fixed quote is always agreed before any treatment begins.
            </p>
            <div className="mt-8 flex justify-center">
              <Button href="/contact">Book a free consultation <ArrowIcon /></Button>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
