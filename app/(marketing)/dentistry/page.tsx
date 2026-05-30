import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { TreatmentCard } from '@/components/ui/TreatmentCard';
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';
import { BookingButtons } from '@/components/booking/BookingButtons';
import { dentistry, groupByGroup } from '@/lib/treatments';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Aesthetic & Cosmetic Dentistry in London | K Clinics',
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
        eyebrow="Aesthetic & Restorative Dentistry"
        title="A smile, designed around you."
        lede="Health-led, beauty-driven dentistry — uniting veneers, whitening, bonding, implants and specialist care under one meticulous standard."
        gradient={['#7b6a5d', '#2a2420']}
      >
        <BookingButtons />
      </PageHero>

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
