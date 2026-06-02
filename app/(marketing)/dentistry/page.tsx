import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { TreatmentCard } from '@/components/ui/TreatmentCard';
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';
import { BookingButtons } from '@/components/booking/BookingButtons';
import { dentistry, groupByGroup } from '@/lib/treatments';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Aesthetic & Cosmetic Dentistry in London | KClinics',
  description:
    'Aesthetic dentistry in Islington, London — porcelain veneers, teeth whitening, composite bonding, dental implants and specialist care, designed for a healthy, beautiful smile.',
  path: '/dentistry',
  keywords: ['cosmetic dentist London', 'dental clinic Islington', 'veneers London', 'dental implants London'],
});

export default function DentistryPage() {
  const groups = groupByGroup(dentistry);
  let idx = 0;
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Dentistry', path: '/dentistry' }])} />
      <PageHero
        eyebrow="Opening soon · Aesthetic & Restorative Dentistry"
        title="A smile, designed around you."
        lede="Health-led, beauty-driven dentistry — uniting veneers, whitening, bonding, implants and specialist care under one meticulous standard."
        gradient={['#7b6a5d', '#2a2420']}
      >
        <BookingButtons consult />
      </PageHero>

      {/* Opening-soon notice */}
      <section className="container-lux pt-10">
        <div className="flex flex-col items-center gap-5 rounded-[var(--radius-xl)] border border-[var(--color-gold)]/45 bg-[var(--color-bone)] px-7 py-8 text-center md:flex-row md:justify-between md:gap-8 md:text-left">
          <div>
            <p className="eyebrow text-[var(--color-gold)]">Opening soon</p>
            <p className="mt-2 max-w-2xl font-[family-name:var(--font-display)] text-2xl leading-snug">
              Our Islington dental suite is opening soon — register your interest and we’ll invite you in first.
            </p>
          </div>
          <div className="shrink-0">
            <BookingButtons consult />
          </div>
        </div>
      </section>

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
    </>
  );
}
