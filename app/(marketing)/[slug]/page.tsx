import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { treatmentSlugs, bookingFor } from '@/lib/treatments';
import { getMergedTreatment } from '@/lib/treatment-content';
import { TreatmentTemplate } from '@/components/treatment/TreatmentTemplate';
import { pageMeta, JsonLd, serviceLd, faqLd, breadcrumbLd } from '@/lib/seo';

export const dynamicParams = false;
// ISR: re-render hourly so admin SEO overrides go live without a redeploy.
export const revalidate = 3600;

export function generateStaticParams() {
  return treatmentSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const t = await getMergedTreatment(slug);
  if (!t) return {};
  // Override merge (title/description/canonical/OG/noindex) is centralised in pageMeta.
  return pageMeta({
    title: t.metaTitle,
    description: t.metaDescription,
    path: `/${t.slug}`,
    keywords: t.keywords,
    ownOgImage: true,
  });
}

export default async function TreatmentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getMergedTreatment(slug);
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
            category: t.category,
            pricePence: bookingFor(t.slug).pricePence,
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
