import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import type { Metadata } from 'next';
import { treatmentSlugs } from '@/lib/treatments';
import { lowestPenceForTreatment } from '@/lib/services';
import { getMergedTreatment } from '@/lib/treatment-content';
import { getPublishedPage, pageMetaFromSections } from '@/lib/pages';
import { TreatmentTemplate } from '@/components/treatment/TreatmentTemplate';
import { SectionRenderer } from '@/components/cms/SectionRenderer';
import { pageMeta, JsonLd, serviceLd, faqLd, breadcrumbLd } from '@/lib/seo';

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
    const { getSiteConfig } = await import('@/lib/site-config');
    const { dentistryLive } = await getSiteConfig(); // BLD-515: live, admin-toggleable flag
    return pageMeta({ title: t.metaTitle, description: t.metaDescription, path: `/${t.slug}`, keywords: t.keywords, ownOgImage: true, noindex: t.category === 'dentistry' && !dentistryLive });
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
    return (
      <>
        <JsonLd
          data={[
            serviceLd({ name: t.title, description: t.metaDescription, path: `/${t.slug}`, category: t.category, pricePence: fromPence }),
            ...(t.faqs.length ? [faqLd(t.faqs)] : []), // never emit an empty FAQPage
            breadcrumbLd([{ name: 'Home', path: '/' }, { name: categoryLabel, path: categoryHref }, { name: t.title, path: `/${t.slug}` }]),
          ]}
        />
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

  // BLD-895: force a live per-request 404 for an unmatched slug — dynamicParams
  // is true here (any admin-published page can appear without a redeploy), but
  // Next's Full Route Cache doesn't persist the notFound() status on a
  // revalidate hit, so a repeat visit to a bad slug soft-404s (200). connection()
  // opts just this branch out of the cache so it's always rendered live.
  await connection();
  notFound();
}
