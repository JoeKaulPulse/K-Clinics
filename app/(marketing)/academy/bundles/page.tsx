import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal } from '@/components/motion/Reveal';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';
import { formatFee } from '@/lib/academy';
import { getActivePromo } from '@/lib/academy-utils';

export const revalidate = 3600;

// BLD-1933: sitemap.ts has listed /academy/bundles since BLD-651, but no
// index page existed — the request fell through to academy/[slug] and 404d.
// This is the real listing page, mirroring the "Learning pathways" section
// on /academy (app/(marketing)/academy/page.tsx) and the card layout used there.
export const generateMetadata = (): Promise<Metadata> => pageMeta({
  title: 'Course Bundles — Multi-Course Training Pathways | K Academy London',
  description: 'Multi-course training bundles at K Academy, Islington — combine accredited aesthetics courses into a single pathway at a combined price.',
  path: '/academy/bundles',
  keywords: ['aesthetics course bundle London', 'K Academy training pathway'],
});

export default async function BundlesIndexPage() {
  const { listBundles } = await import('@/lib/academy');
  const bundles = await listBundles().catch(() => []);
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
          {bundles.map((b) => (
            <Reveal key={b.id}>
              <Link href={`/academy/bundles/${b.slug}`} className="group flex h-full flex-col rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-ink)] p-6 text-[var(--color-porcelain)] transition-colors hover:border-[var(--color-gold)]">
                <span className="text-xs uppercase tracking-[0.16em] text-[var(--color-gold-soft)]">{b.courses.length} course{b.courses.length === 1 ? '' : 's'} · pathway</span>
                <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl leading-tight">{b.title}</h2>
                {b.summary && <p className="mt-2 flex-1 text-sm text-[var(--color-porcelain)]/75">{b.summary}</p>}
                <div className="mt-4 flex items-center justify-between">
                  {(() => {
                    const bp = getActivePromo(b);
                    if (bp != null) {
                      return (
                        <span className="text-sm font-medium text-[var(--color-gold-soft)]">
                          {formatFee(bp)}{' '}
                          {b.pricePence != null && b.pricePence > bp && <s className="ml-1 font-normal text-[var(--color-porcelain)]/55">{formatFee(b.pricePence)}</s>}
                        </span>
                      );
                    }
                    return <span className="text-sm font-medium">{b.pricePence != null ? formatFee(b.pricePence) : 'On enquiry'}</span>;
                  })()}
                  <span className="text-sm text-[var(--color-gold-soft)] group-hover:underline">View pathway →</span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
