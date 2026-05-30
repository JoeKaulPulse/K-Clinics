import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getTreatment, treatmentSlugs } from '@/lib/treatments';
import { TreatmentTemplate } from '@/components/treatment/TreatmentTemplate';
import { pageMeta, JsonLd, serviceLd, faqLd, breadcrumbLd } from '@/lib/seo';

export const dynamicParams = false;

export function generateStaticParams() {
  return treatmentSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const t = getTreatment(slug);
  if (!t) return {};
  return pageMeta({
    title: t.metaTitle,
    description: t.metaDescription,
    path: `/${t.slug}`,
    keywords: t.keywords,
  });
}

export default async function TreatmentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = getTreatment(slug);
  if (!t) notFound();

  const categoryHref = t.category === 'aesthetics' ? '/treatments' : '/dentistry';
  const categoryLabel = t.category === 'aesthetics' ? 'Aesthetics' : 'Dentistry';

  return (
    <>
      <JsonLd
        data={[
          serviceLd({
            name: t.title,
            description: t.metaDescription,
            path: `/${t.slug}`,
            category: t.group,
          }),
          faqLd(t.faqs),
          breadcrumbLd([
            { name: 'Home', path: '/' },
            { name: categoryLabel, path: categoryHref },
            { name: t.title, path: `/${t.slug}` },
          ]),
        ]}
      />
      <TreatmentTemplate t={t} />
    </>
  );
}
