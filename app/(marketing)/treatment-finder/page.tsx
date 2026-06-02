import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { TreatmentFinder } from '@/components/finder/TreatmentFinder';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Treatment Finder — Find Your Ideal Treatment | KClinics London',
  description:
    'Answer a few quick questions and discover the KClinics treatments best suited to your skin, smile or body goals. Personalised, no obligation.',
  path: '/treatment-finder',
  keywords: ['treatment finder', 'which aesthetic treatment', 'skin treatment quiz London', 'best treatment for me'],
});

// Dynamic so a signed-in client's gender can tailor the suggestions; anonymous
// visitors see the full set. (Metadata above is unaffected.)
export const dynamic = 'force-dynamic';

export default async function TreatmentFinderPage() {
  let gender: string | null = null;
  try {
    const { crmEnabled } = await import('@/lib/crm');
    if (crmEnabled) {
      const { getCurrentClient } = await import('@/lib/client-auth');
      gender = (await getCurrentClient())?.gender ?? null;
    }
  } catch { /* finder works fine without a session */ }

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
        <TreatmentFinder gender={gender} />
      </section>
    </>
  );
}
