import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal } from '@/components/motion/Reveal';
import { getInfoPage, infoSlugs } from '@/lib/info-pages';
import { FranchiseEnquiryForm } from '@/components/franchise/FranchiseEnquiryForm';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const dynamicParams = false;
export function generateStaticParams() {
  return infoSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = getInfoPage(slug);
  if (!p) return {};
  return pageMeta({ title: `${p.title} | KClinics`, description: p.intro.slice(0, 155), path: `/info/${slug}` });
}

// Pages that now have richer, dedicated routes.
const REDIRECTS: Record<string, string> = { careers: '/careers', 'refer-a-friend': '/refer-a-friend', 'gift-vouchers': '/gift-vouchers' };

export default async function InfoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (REDIRECTS[slug]) redirect(REDIRECTS[slug]);
  const p = getInfoPage(slug);
  if (!p) notFound();

  // Render an admin-published CMS layout for this policy page if one exists.
  const { getPublishedPage } = await import('@/lib/pages');
  const cms = await getPublishedPage(`/info/${slug}`);
  if (cms) {
    const { SectionRenderer } = await import('@/components/cms/SectionRenderer');
    return (<><JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: p.title, path: `/info/${slug}` }])} /><SectionRenderer sections={cms} /></>);
  }

  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: p.title, path: `/info/${slug}` }])} />
      <PageHero eyebrow="KClinics" title={p.title} lede={p.intro} gradient={['#3d352f', '#7b6a5d']} />

      <section className="container-narrow section">
        <div className="space-y-8">
          {p.blocks.map((b, i) => (
            <Reveal key={i}>
              <div>
                {b.heading && <h2 className="font-[family-name:var(--font-display)] text-2xl">{b.heading}</h2>}
                <p className="mt-3 leading-relaxed text-[var(--color-stone)]">{b.body}</p>
              </div>
            </Reveal>
          ))}
          {slug === 'franchise-opportunities' && (
            <Reveal>
              <div className="pt-4"><FranchiseEnquiryForm /></div>
            </Reveal>
          )}
        </div>
      </section>
    </>
  );
}
