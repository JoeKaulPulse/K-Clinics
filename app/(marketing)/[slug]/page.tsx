import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { treatmentSlugs } from '@/lib/treatments';
import { lowestPenceForTreatment } from '@/lib/services';
import { getMergedTreatment } from '@/lib/treatment-content';
import { getPublishedPage, pageMetaFromSections } from '@/lib/pages';
import { TreatmentTemplate } from '@/components/treatment/TreatmentTemplate';
import { SectionRenderer } from '@/components/cms/SectionRenderer';
import { pageMeta, JsonLd, serviceLd, faqLd, breadcrumbLd } from '@/lib/seo';
import { ViewItemTracker } from '@/components/marketing/ViewItemTracker';

// Single-segment routes: treatment pages (static) + any admin-built CMS page
// published at /<slug>. Folder routes (/about, /contact, …) take precedence.
export const dynamicParams = true;
// ISR: re-render hourly so admin content/SEO overrides go live without a redeploy.
export const revalidate = 3600;

export function generateStaticParams() {
  return treatmentSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const t = await getMergedTreatment(slug);
  if (t) {
    // BLD-1250: no noindex on dentistry treatment pages pre-launch -- per BLD-157
    // (see app/(marketing)/dentistry/page.tsx) their coming-soon title/description
    // already frame them honestly, so they stay indexed regardless of dentistryLive.
    return pageMeta({ title: t.metaTitle, description: t.metaDescription, path: `/${t.slug}`, keywords: t.keywords, ownOgImage: true });
  }
  const cms = await getPublishedPage(`/${slug}`);
  if (cms) { const m = pageMetaFromSections(cms); return pageMeta({ title: m.title || slug, description: m.description, path: `/${slug}` }); }
  return {};
}

export default async function TreatmentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getMergedTreatment(slug);

  if (t) {
    const categoryHref = t.category === 'aesthetics' ? '/treatments' : '/dentistry';
    const categoryLabel = t.category === 'aesthetics' ? 'Aesthetics' : 'Dentistry';
    const fromPence = await lowestPenceForTreatment(t.slug);
    // serviceLd() returns an array (Procedure + Offer/Service) when pricePence is
    // set, a single object otherwise — always spread so it never nests as one
    // element (PRJ-1060.1).
    const sld = serviceLd({ name: t.title, description: t.metaDescription, path: `/${t.slug}`, category: t.category, pricePence: fromPence });
    return (
      <>
        <JsonLd
          data={[
            ...(Array.isArray(sld) ? sld : [sld]),
            ...(t.faqs.length ? [faqLd(t.faqs)] : []), // never emit an empty FAQPage
            breadcrumbLd([{ name: 'Home', path: '/' }, { name: categoryLabel, path: categoryHref }, { name: t.title, path: `/${t.slug}` }]),
          ]}
        />
        <ViewItemTracker id={t.slug} name={t.title} category={t.category} valuePence={fromPence ?? 0} />
        <TreatmentTemplate t={t} />
      </>
    );
  }

  // Admin-built CMS page published at this path.
  const cms = await getPublishedPage(`/${slug}`);
  if (cms) {
    const m = pageMetaFromSections(cms);
    return (
      <>
        <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: m.title || slug, path: `/${slug}` }])} />
        <SectionRenderer sections={cms} />
      </>
    );
  }

  notFound();
}
