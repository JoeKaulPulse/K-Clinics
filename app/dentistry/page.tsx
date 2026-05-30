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
        gradient={['#7a4f57', '#2b1d24']}
      >
        <BookingButtons />
      </PageHero>

      {Object.entries(groups).map(([group, list]) => (
        <section key={group} className="container-lux section-sm">
          <Reveal>
            <div className="mb-10 flex items-end justify-between gap-6 border-b border-[var(--color-line)] pb-5">
              <h2 className="text-title">{group}</h2>
              <span className="text-sm text-[var(--color-stone)]">{list.length} treatments</span>
            </div>
          </Reveal>
          <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((t) => {
              const i = idx++;
              return (
                <StaggerItem key={t.slug}>
                  <TreatmentCard t={t} index={i} />
                </StaggerItem>
              );
            })}
          </Stagger>
        </section>
      ))}
    </>
  );
}
