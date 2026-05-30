import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { TreatmentCard } from '@/components/ui/TreatmentCard';
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';
import { BookingButtons } from '@/components/booking/BookingButtons';
import { aesthetics, groupByGroup } from '@/lib/treatments';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Aesthetic Treatments in London — Laser, Skin & Body | K Clinics',
  description:
    'Explore K Clinics’ full menu of aesthetic treatments in Islington, London — laser hair removal, HIFU lifting, advanced facials, body contouring and injectables.',
  path: '/treatments',
  keywords: ['aesthetic clinic London', 'laser clinic Islington', 'skin treatments London', 'non-surgical treatments'],
});

export default function TreatmentsPage() {
  const groups = groupByGroup(aesthetics);
  let idx = 0;
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Aesthetics', path: '/treatments' }])} />
      <PageHero
        eyebrow="Aesthetics · Laser · Skin · Body"
        title="The art and science of looking remarkable."
        lede="From medical-grade laser to non-surgical lifting and refined injectables — every treatment is calibrated to you, and delivered with the precision a premium result demands."
        gradient={['#a98a6d', '#7b6a5d']}
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
