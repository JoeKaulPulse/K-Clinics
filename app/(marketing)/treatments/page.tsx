import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { TreatmentCard } from '@/components/ui/TreatmentCard';
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';
import { BookingButtons } from '@/components/booking/BookingButtons';
import { aesthetics, groupByGroup } from '@/lib/treatments';
import { withCardOverrides } from '@/lib/treatment-content';
import { pageMeta, JsonLd, breadcrumbLd, itemListLd } from '@/lib/seo';

export const revalidate = 3600;

export const generateMetadata = (): Promise<Metadata> => pageMeta({
  title: 'Aesthetic Treatments in London — Laser, Skin & Body | KClinics',
  description:
    'Explore KClinics’ full menu of aesthetic treatments in Islington, London — laser hair removal, HIFU lifting, advanced facials, body contouring and injectables.',
  path: '/treatments',
  keywords: ['aesthetic clinic London', 'laser clinic Islington', 'skin treatments London', 'non-surgical treatments'],
});

export default async function TreatmentsPage() {
  const list = await withCardOverrides(aesthetics);
  const groups = groupByGroup(list);
  let idx = 0;
  return (
    <>
      <JsonLd data={[
        breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Aesthetics', path: '/treatments' }]),
        itemListLd('Aesthetic treatments at KClinics', list.map((t) => ({ name: t.title, path: `/${t.slug}` }))),
      ]} />
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
