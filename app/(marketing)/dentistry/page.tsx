import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { TreatmentCard } from '@/components/ui/TreatmentCard';
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';
import { BookingButtons } from '@/components/booking/BookingButtons';
import { Button, ArrowIcon } from '@/components/ui/Button';
import { RegisterInterest } from '@/components/dentistry/RegisterInterest';
import { dentistry, groupByGroup } from '@/lib/treatments';
import { withCardOverrides } from '@/lib/treatment-content';
import { site } from '@/lib/site';
import { pageMeta, JsonLd, breadcrumbLd, itemListLd } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMeta({
  title: site.dentistryLive
    ? 'Aesthetic & Cosmetic Dentistry in London | KClinics'
    : 'Aesthetic & Cosmetic Dentistry — Opening Soon | KClinics London',
  description:
    'Aesthetic dentistry coming soon to KClinics, Islington — porcelain veneers, teeth whitening, composite bonding, dental implants and specialist care. Register your interest.',
  path: '/dentistry',
  keywords: ['cosmetic dentist London', 'dental clinic Islington', 'veneers London', 'dental implants London'],
});

export default async function DentistryPage() {
  const list = await withCardOverrides(dentistry);
  const groups = groupByGroup(list);
  const comingSoon = !site.dentistryLive;
  let idx = 0;
  return (
    <>
      <JsonLd data={[
        breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Dentistry', path: '/dentistry' }]),
        itemListLd('Dentistry treatments at KClinics', list.map((t) => ({ name: t.title, path: `/${t.slug}` }))),
      ]} />
      <PageHero
        eyebrow={comingSoon ? 'Aesthetic Dentistry · Opening soon' : 'Aesthetic & Restorative Dentistry'}
        title="A smile, designed around you."
        lede={comingSoon
          ? 'Our dentistry suite is coming soon to Clerkenwell — veneers, whitening, bonding, implants and specialist care, to the same meticulous standard as the rest of KClinics. Register your interest and you’ll be first to know when it opens.'
          : 'Health-led, beauty-driven dentistry — uniting veneers, whitening, bonding, implants and specialist care under one meticulous standard.'}
        gradient={['#7b6a5d', '#2a2420']}
      >
        {comingSoon
          ? <Button href="#interest" variant="gold" size="lg">Register your interest <ArrowIcon /></Button>
          : <BookingButtons />}
      </PageHero>

      {comingSoon && (
        <section className="border-b border-[var(--color-line)] bg-[var(--color-bone)]">
          <div className="container-lux flex flex-wrap items-center justify-center gap-3 py-5 text-center text-sm text-[var(--color-ink-soft)]">
            <span className="rounded-full bg-[var(--color-gold-soft)] px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink)]">Opening soon</span>
            <span>Browse what’s coming below. Dentistry isn’t bookable just yet — <a href="#interest" className="link-underline font-medium text-[var(--color-ink)]">register your interest</a> and we’ll be in touch.</span>
          </div>
        </section>
      )}

      {Object.entries(groups).map(([group, list]) => (
        <section key={group} className="container-lux section-sm">
          <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[0.8fr_2.2fr]">
            <Reveal>
              <div className="lg:sticky lg:top-28 lg:self-start">
                <h2 className="text-title">{group}</h2>
                <p className="mt-3 text-sm text-[var(--color-stone)]">{list.length} treatments</p>
                <span className="mt-6 hidden h-px w-16 bg-[var(--color-gold)]/50 lg:block" />
              </div>
            </Reveal>
            <Stagger className="grid gap-6 sm:grid-cols-2">
              {list.map((t) => {
                const i = idx++;
                return (
                  <StaggerItem key={t.slug}>
                    <TreatmentCard t={t} index={i} />
                  </StaggerItem>
                );
              })}
            </Stagger>
          </div>
        </section>
      ))}

      {comingSoon && (
        <section id="interest" className="scroll-mt-28 bg-[var(--color-bone)] section">
          <div className="container-lux">
            <div className="mx-auto max-w-2xl rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-8 text-center md:p-12">
              <p className="eyebrow mb-3">Be first in the chair</p>
              <h2 className="text-title">Register your interest in dentistry.</h2>
              <p className="mx-auto mt-4 max-w-xl text-[var(--color-stone)]">
                Leave your email and we’ll let you know the moment our dentistry suite opens — including any launch offers for early registrants.
              </p>
              <div className="mt-7 flex justify-center">
                <RegisterInterest />
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
