import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { TreatmentFinder } from '@/components/finder/TreatmentFinder';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Treatment Finder — Find Your Ideal Treatment | K Clinics London',
  description:
    'Answer a few quick questions and discover the K Clinics treatments best suited to your skin, smile or body goals. Personalised, no obligation.',
  path: '/treatment-finder',
  keywords: ['treatment finder', 'which aesthetic treatment', 'skin treatment quiz London', 'best treatment for me'],
});

export default function TreatmentFinderPage() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Treatment Finder', path: '/treatment-finder' }])} />
      <PageHero
        eyebrow="Personalised guidance"
        title="Find your treatment."
        lede="A minute of questions, a tailored set of suggestions. There’s no obligation — just a smart starting point for your complimentary consultation."
        gradient={['#a98a6d', '#3d352f']}
      />
      <section className="container-lux section">
        <TreatmentFinder />
      </section>
    </>
  );
}
