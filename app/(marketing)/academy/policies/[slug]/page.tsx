import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal } from '@/components/motion/Reveal';
import { academyPolicySlugs, getAcademyPolicy } from '@/lib/academy-policies';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const dynamicParams = false;
export function generateStaticParams() {
  return academyPolicySlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = getAcademyPolicy(slug);
  if (!p) return {};
  return pageMeta({ title: `${p.title} | K Academy`, description: p.summary.slice(0, 155), path: `/academy/policies/${slug}` });
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export default async function AcademyPolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getAcademyPolicy(slug);
  if (!p) notFound();

  const crumbs = breadcrumbLd([
    { name: 'Home', path: '/' },
    { name: 'Academy', path: '/academy' },
    { name: 'Centre policies', path: '/academy/policies' },
    { name: p.title, path: `/academy/policies/${slug}` },
  ]);

  // Owner-rewritten version: a published CMS page at this path wins over the
  // code default (same mechanism as /info/<slug>).
  const { getPublishedPage } = await import('@/lib/pages');
  const cms = await getPublishedPage(`/academy/policies/${slug}`);
  if (cms) {
    const { SectionRenderer } = await import('@/components/cms/SectionRenderer');
    return (<><JsonLd data={crumbs} /><SectionRenderer sections={cms} /></>);
  }

  return (
    <>
      <JsonLd data={crumbs} />
      <PageHero eyebrow="K Academy · Centre policy" title={p.title} lede={p.summary} gradient={['#2a2420', '#7b6a5d']} />

      <section className="container-narrow section">
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">
          Version {p.version} · Reviewed {fmt(p.reviewed)} · Next review {fmt(p.nextReview)}
        </p>
        <div className="mt-8 space-y-8">
          {p.sections.map((s) => (
            <Reveal key={s.heading}>
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-2xl">{s.heading}</h2>
                {s.body.map((para, i) => (
                  <p key={i} className="mt-3 leading-relaxed text-[var(--color-stone)]">{para}</p>
                ))}
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mt-12 text-sm text-[var(--color-stone)]">
          <Link href="/academy/policies" className="link-underline">All centre policies</Link> · Questions: support@kclinics.co.uk
        </p>
      </section>
    </>
  );
}
