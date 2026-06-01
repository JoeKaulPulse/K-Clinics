import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getTreatment, treatmentSlugs, bookingFor } from '@/lib/treatments';
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
  const t = getTreatment(slug);
  if (!t) return {};
  const meta = pageMeta({
    title: t.metaTitle,
    description: t.metaDescription,
    path: `/${t.slug}`,
    keywords: t.keywords,
    ownOgImage: true,
  });
  // Merge any admin SEO override (best-effort; no-op without a DB).
  try {
    const { getPageOverride } = await import('@/lib/seo-audit');
    const ov = await getPageOverride(`/${t.slug}`);
    if (ov) {
      if (ov.title) meta.title = { absolute: ov.title };
      if (ov.description) meta.description = ov.description;
      if (ov.canonical) meta.alternates = { ...(meta.alternates || {}), canonical: ov.canonical };
      if (ov.noindex) meta.robots = { index: false, follow: true };
      if (ov.ogImage) meta.openGraph = { ...(meta.openGraph || {}), images: [{ url: ov.ogImage }] };
    }
  } catch { /* overrides are best-effort */ }
  return meta;
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
