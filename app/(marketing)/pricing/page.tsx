import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal } from '@/components/motion/Reveal';
import { BookingButtons } from '@/components/booking/BookingButtons';
import { Button, ArrowIcon } from '@/components/ui/Button';
import { listServices, liveOffers, bestOffer, effectiveStatus, statusLabel, formatPence, type ServiceStatus } from '@/lib/services';
import { getTreatment } from '@/lib/treatments';
import { crmEnabled } from '@/lib/crm';

type PricedRow = { id: string; name: string; courses: { sessions: number; totalPence: number }[]; status: ServiceStatus; pricePence: number; offerPence: number | null; offerName: string | null };
type PricedService = { id: string; name: string; treatmentSlug: string; rows: PricedRow[] };
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
  const groups = new Map<string, PricedService[]>();
  let offerItems: { name: string; price: number }[] = [];
  if (crmEnabled) {
    try {
      const [services, offers] = await Promise.all([listServices(false), liveOffers(false)]);
      for (const s of services.filter((x) => x.variants.length > 0 && x.status !== 'UNAVAILABLE')) {
        const rows: PricedRow[] = s.variants.map((v) => {
          const status = effectiveStatus(s.status, v.status);
          const off = status === 'NORMAL' && v.pricePence > 0 ? bestOffer(offers, s.id, v.id, v.pricePence) : null;
          return { id: v.id, name: v.name, courses: v.courses, status, pricePence: v.pricePence, offerPence: off ? Math.max(0, v.pricePence - off.discountPence) : null, offerName: off?.offer.name ?? null };
        });
        const group = getTreatment(s.treatmentSlug)?.group || 'Treatments';
        const arr = groups.get(group) ?? [];
        arr.push({ id: s.id, name: s.name, treatmentSlug: s.treatmentSlug, rows });
        groups.set(group, arr);
        // Priced OfferCatalog from bookable single-session prices, for rich SEO snippets.
        offerItems = offerItems.concat(rows.filter((r) => r.status === 'NORMAL' && r.pricePence > 0).map((r) => ({ name: `${s.name} — ${r.name}`, price: (r.offerPence ?? r.pricePence) / 100 })));
      }
    } catch { /* no DB → show the consultation fallback below */ }
  }

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
                          {s.rows.map((v) => {
                            const unavailable = v.status === 'COMING_SOON' || v.status === 'UNAVAILABLE';
                            // Bookable rows (incl. on-consultation) link straight into the
                            // booking flow pre-set to this treatment.
                            const body = (
                              <>
                                <div className="min-w-0">
                                  <span className="font-[family-name:var(--font-display)] text-lg leading-tight">{v.name}</span>
                                  {!unavailable && v.courses.length > 0 && (
                                    <span className="mt-1 block space-y-0.5 text-sm text-[var(--color-stone)]">
                                      {v.courses.map((c) => {
                                        const per = Math.round(c.totalPence / c.sessions);
                                        const save = v.pricePence > 0 ? Math.round((1 - per / v.pricePence) * 100) : 0;
                                        return (
                                          <span key={c.sessions} className="block">
                                            Course of {c.sessions} — <span className="font-medium text-[var(--color-ink)]">{formatPence(c.totalPence)}</span>
                                            <span className="text-[var(--color-stone-soft)]"> ({formatPence(per)}/session{save > 0 ? <>, <span className="text-[var(--color-gold-deep)]">save {save}%</span></> : ''})</span>
                                          </span>
                                        );
                                      })}
                                    </span>
                                  )}
                                  {v.offerName && <span className="mt-0.5 block text-sm font-medium text-[var(--color-gold)]">{v.offerName}</span>}
                                </div>
                                <span className="flex shrink-0 items-center gap-2 font-[family-name:var(--font-display)] text-lg text-[var(--color-ink)]">
                                  {unavailable ? (
                                    <span className="text-sm font-medium uppercase tracking-wide text-[var(--color-stone)]">{statusLabel(v.status)}</span>
                                  ) : v.status === 'CONSULTATION' ? (
                                    <span className="text-base text-[var(--color-stone)]">On consultation</span>
                                  ) : v.offerPence != null ? (
                                    <span><span className="mr-2 text-base text-[var(--color-stone-soft)] line-through">{formatPence(v.pricePence)}</span>{formatPence(v.offerPence)}</span>
                                  ) : (
                                    formatPence(v.pricePence)
                                  )}
                                  {!unavailable && (
                                    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 shrink-0 text-[var(--color-gold)] opacity-50 transition-opacity group-hover:opacity-100" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                  )}
                                </span>
                              </>
                            );
                            const rowCls = 'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-4 transition-colors hover:bg-[var(--color-bone)]';
                            return unavailable ? (
                              <li key={v.id} className={rowCls}>{body}</li>
                            ) : (
                              <li key={v.id}>
                                <Link href={`/book?treatment=${s.treatmentSlug}`} aria-label={`Book ${s.name} — ${v.name}`} className={`group ${rowCls}`}>{body}</Link>
                              </li>
                            );
                          })}
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
