import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal } from '@/components/motion/Reveal';
import { getInfoPage, infoSlugs } from '@/lib/info-pages';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const dynamicParams = false;
export function generateStaticParams() {
  return infoSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = getInfoPage(slug);
  if (!p) return {};
  return pageMeta({ title: `${p.title} | K Clinics`, description: p.intro.slice(0, 155), path: `/info/${slug}` });
}

// Pages that now have richer, dedicated routes.
const REDIRECTS: Record<string, string> = { careers: '/careers' };

export default async function InfoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (REDIRECTS[slug]) redirect(REDIRECTS[slug]);
  const p = getInfoPage(slug);
  if (!p) notFound();

  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: p.title, path: `/info/${slug}` }])} />
      <PageHero eyebrow="K Clinics" title={p.title} lede={p.intro} gradient={['#3d352f', '#7b6a5d']} />

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
        </div>
      </section>
    </>
  );
}
