import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal } from '@/components/motion/Reveal';
import { BookingButtons } from '@/components/booking/BookingButtons';
import { Button, ArrowIcon } from '@/components/ui/Button';
import { priceList, formatGBP } from '@/lib/pricing';
import { OffersStrip } from '@/components/marketing/OffersStrip';
import { pageMeta, JsonLd, breadcrumbLd, offerCatalogLd } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMeta({
  title: 'Price List — Aesthetics & Laser Treatments in London | KClinics',
  description:
    'Full, transparent price list for KClinics, Islington — laser hair removal, HIFU lifting, HydraFacial, carbon peel, tattoo & pigmentation removal, body contouring and more. Course savings available.',
  path: '/pricing',
  keywords: ['laser hair removal prices London', 'HIFU cost London', 'hydrafacial price', 'tattoo removal cost London', 'aesthetic treatment prices'],
});

export default function PricingPage() {
  // Build a priced OfferCatalog from every single-session price on the list.
  const offerItems = priceList.flatMap((g) =>
    g.rows.filter((r) => typeof r.session === 'number').map((r) => ({ name: r.name, price: r.session as number })),
  );
  return (
    <>
      <JsonLd data={[
        breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Pricing', path: '/pricing' }]),
        offerCatalogLd(offerItems),
      ]} />
      <PageHero
        eyebrow="Transparent pricing"
        title="Every price, in plain sight."
        lede="Our full published price list. Most treatments offer reduced per-session rates when booked as a course — and new clients enjoy 15% off their first visit."
        gradient={['#3d352f', '#a98a6d']}
      >
        <BookingButtons />
      </PageHero>

      <div className="container-lux pt-10"><OffersStrip /></div>

      <section className="container-lux section">
        <div className="space-y-[var(--space-section-sm)]">
          {priceList.map((group) => (
            <Reveal key={group.heading}>
              <div>
                <div className="mb-6 border-b border-[var(--color-ink)] pb-4">
                  <h2 className="text-title">{group.heading}</h2>
                  {group.note && <p className="mt-2 text-sm text-[var(--color-stone)]">{group.note}</p>}
                </div>

                {/* Column header (desktop) */}
                <div className="hidden grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-4 pb-2 text-xs uppercase tracking-[0.16em] text-[var(--color-stone)] md:grid">
                  <span>Treatment</span>
                  <span className="text-right">Single</span>
                  <span className="text-right">×3</span>
                  <span className="text-right">×6</span>
                  <span className="text-right">×10</span>
                </div>

                <ul className="divide-y divide-[var(--color-line)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
                  {group.rows.map((row) => {
                    const c = (n: number) => row.course?.find((x) => x.sessions === n);
                    return (
                      <li key={row.name} className="grid grid-cols-2 gap-x-4 gap-y-1 px-4 py-4 transition-colors hover:bg-[var(--color-bone)] md:grid-cols-[2fr_1fr_1fr_1fr_1fr] md:items-center">
                        <span className="col-span-2 font-[family-name:var(--font-display)] text-lg leading-tight md:col-span-1">{row.name}</span>
                        <PriceCell label="Single" value={typeof row.session === 'number' ? `£${row.session}` : row.session} highlight />
                        <PriceCell label="×3" value={c(3) ? formatGBP(c(3)!.total) : '—'} />
                        <PriceCell label="×6" value={c(6) ? formatGBP(c(6)!.total) : c(2) ? `×2 ${formatGBP(c(2)!.total)}` : '—'} />
                        <PriceCell label="×10" value={c(10) ? formatGBP(c(10)!.total) : c(5) ? `×5 ${formatGBP(c(5)!.total)}` : c(4) ? `×4 ${formatGBP(c(4)!.total)}` : '—'} />
                      </li>
                    );
                  })}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <div className="mt-[var(--space-section-sm)] rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 text-center md:p-12">
            <p className="eyebrow mb-3">Aesthetic dentistry</p>
            <p className="mx-auto max-w-2xl text-lg text-[var(--color-stone)]">
              Veneers, whitening, bonding and implants are quoted individually after a consultation, as every smile plan is bespoke. Book a complimentary consultation for a clear, fixed quote.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Button href="/book">Book online <ArrowIcon /></Button>
              <Button href="/consultation" variant="outline">Free consultation</Button>
            </div>
          </div>
        </Reveal>

        <Reveal>
          <p className="mt-10 text-center text-sm text-[var(--color-stone)]">
            All prices in GBP. Course prices show the total for the package. Your full, fixed quote is always agreed before treatment begins.
          </p>
        </Reveal>
      </section>
    </>
  );
}

function PriceCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <span className="flex items-baseline justify-between md:block md:text-right">
      <span className="text-xs uppercase tracking-[0.14em] text-[var(--color-stone-soft)] md:hidden">{label}</span>
      <span className={`font-[family-name:var(--font-display)] ${highlight ? 'text-lg text-[var(--color-ink)]' : 'text-base text-[var(--color-stone)]'}`}>{value}</span>
    </span>
  );
}
