import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal } from '@/components/motion/Reveal';
import { BookingButtons } from '@/components/booking/BookingButtons';
import { Button, ArrowIcon } from '@/components/ui/Button';
import { listServices, formatPence, type ServiceView } from '@/lib/services';
import { getTreatment } from '@/lib/treatments';
import { crmEnabled } from '@/lib/crm';
import { OffersStrip } from '@/components/marketing/OffersStrip';
import { pageMeta, JsonLd, breadcrumbLd, offerCatalogLd } from '@/lib/seo';

// ISR: refresh hourly so admin price edits go live without a redeploy.
export const revalidate = 3600;

export const generateMetadata = (): Promise<Metadata> => pageMeta({
  title: 'Price List — Aesthetics & Laser Treatments in London | KClinics',
  description:
    'Full, transparent price list for KClinics, Islington — laser hair removal, HIFU lifting, HydraFacial, carbon peel, tattoo & pigmentation removal, body contouring and more. Course savings available.',
  path: '/pricing',
  keywords: ['laser hair removal prices London', 'HIFU cost London', 'hydrafacial price', 'tattoo removal cost London', 'aesthetic treatment prices'],
});

export default async function PricingPage() {
  // Every price comes from the live admin catalogue — nothing is hardcoded.
  // Safe (empty) when the CRM/DB isn't available, e.g. the static demo build.
  let services: ServiceView[] = [];
  if (crmEnabled) {
    try { services = (await listServices(false)).filter((s) => s.variants.length > 0); }
    catch { /* no DB → show the consultation fallback below */ }
  }

  // Group services under their treatment's marketing group for a tidy menu.
  const groups = new Map<string, typeof services>();
  for (const s of services) {
    const group = getTreatment(s.treatmentSlug)?.group || 'Treatments';
    const arr = groups.get(group) ?? [];
    arr.push(s);
    groups.set(group, arr);
  }

  // Priced OfferCatalog from every single-session price, for rich SEO snippets.
  const offerItems = services.flatMap((s) =>
    s.variants.filter((v) => v.pricePence > 0).map((v) => ({ name: `${s.name} — ${v.name}`, price: v.pricePence / 100 })),
  );

  return (
    <>
      <JsonLd data={[
        breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Pricing', path: '/pricing' }]),
        ...(offerItems.length ? [offerCatalogLd(offerItems)] : []),
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
        {groups.size > 0 ? (
          <div className="space-y-[var(--space-section-sm)]">
            {[...groups.entries()].map(([group, list]) => (
              <Reveal key={group}>
                <div>
                  <div className="mb-6 border-b border-[var(--color-ink)] pb-4">
                    <h2 className="text-title">{group}</h2>
                  </div>
                  <div className="space-y-8">
                    {list.map((s) => (
                      <div key={s.id}>
                        <h3 className="mb-3 font-[family-name:var(--font-display)] text-xl">{s.name}</h3>
                        <ul className="divide-y divide-[var(--color-line)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
                          {s.variants.map((v) => (
                            <li key={v.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-4 transition-colors hover:bg-[var(--color-bone)]">
                              <div className="min-w-0">
                                <span className="font-[family-name:var(--font-display)] text-lg leading-tight">{v.name}</span>
                                {v.courses.length > 0 && (
                                  <span className="mt-0.5 block text-sm text-[var(--color-stone)]">
                                    {v.courses.map((c) => `×${c.sessions} ${formatPence(c.totalPence)}`).join(' · ')}
                                  </span>
                                )}
                              </div>
                              <span className="shrink-0 font-[family-name:var(--font-display)] text-lg text-[var(--color-ink)]">{formatPence(v.pricePence)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        ) : (
          <Reveal>
            <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 text-center md:p-12">
              <p className="eyebrow mb-3">Pricing</p>
              <p className="mx-auto max-w-2xl text-lg text-[var(--color-stone)]">
                Our full price list is being updated. In the meantime, book a complimentary consultation or get in touch and we’ll be delighted to talk you through pricing.
              </p>
              <div className="mt-8 flex justify-center gap-3">
                <Button href="/book">Book online <ArrowIcon /></Button>
                <Button href="/consultation" variant="outline">Free consultation</Button>
              </div>
            </div>
          </Reveal>
        )}

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
