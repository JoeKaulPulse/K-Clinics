import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHero } from '@/components/ui/PageHero';
import { BundleCard } from '@/components/academy/BundleCard';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const revalidate = 3600;

// BLD-1933: sitemap.ts has listed /academy/bundles since BLD-651, but no
// index page existed — the request fell through to academy/[slug] and 404d.
// This is the real listing page, mirroring the "Learning pathways" section
// on /academy (app/(marketing)/academy/page.tsx); both render <BundleCard>.
export const generateMetadata = (): Promise<Metadata> => pageMeta({
  title: 'Course Bundles — Multi-Course Training Pathways | K Academy London',
  description: 'Multi-course training bundles at K Academy, Islington — combine accredited aesthetics courses into a single pathway at a combined price.',
  path: '/academy/bundles',
  keywords: ['aesthetics course bundle London', 'K Academy training pathway'],
});

export default async function BundlesIndexPage() {
  const { listBundles } = await import('@/lib/academy');
  const bundles = await listBundles().catch(() => []);
  // No active bundles: 404 rather than an empty page. sitemap.ts only lists
  // this path while at least one bundle is active, so the two stay consistent.
  if (bundles.length === 0) notFound();

  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Academy', path: '/academy' }, { name: 'Bundles', path: '/academy/bundles' }])} />
      <PageHero
        eyebrow="K Academy · Learning pathways"
        title="Course bundles"
        lede="Guided sequences of accredited courses at a combined price — train in the right order, from foundation through to advanced."
        gradient={['#2a2420', '#7b6a5d']}
      />

      <section className="container-lux section">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {bundles.map((b) => <BundleCard key={b.id} bundle={b} heading="h2" />)}
        </div>
      </section>
    </>
  );
}
