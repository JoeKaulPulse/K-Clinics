import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { treatmentSlugs, adSensitiveTreatment } from '@/lib/treatments';
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
    // BLD-1250: dentistry pages stay indexed pre-launch, per the owner's BLD-157
    // decision (see app/(marketing)/dentistry/page.tsx) -- but only on BLD-157's
    // own terms: index the page, and frame its title/description for the intent it
    // can satisfy today. The hub swaps its copy for that reason; a treatment page's
    // metaTitle/metaDescription are static commercial copy in lib/treatments.ts
    // ("Bespoke porcelain veneers in Islington, London ... at KClinics"), so
    // indexing them unchanged would put a bookable-sounding dental service in the
    // SERP that the clinic cannot deliver until a GDC-registered dentist is in
    // post. Swap to coming-soon framing while dentistryLive is false; the page
    // itself already shows an "Opening soon" badge and a register-interest CTA
    // instead of a booking button (components/treatment/TreatmentTemplate.tsx).
    // The swap deliberately overrides any TreatmentContent metaTitle an admin has
    // typed -- pre-launch honesty is not an editorial choice. The PageSeo panel
    // override still wins over both (lib/seo.tsx pageMeta), so a per-URL snippet
    // can still be set by hand if the owner wants one.
    let title = t.metaTitle;
    let description = t.metaDescription;
    if (t.category === 'dentistry') {
      const { getSiteConfig } = await import('@/lib/site-config');
      const { dentistryLive } = await getSiteConfig(); // BLD-515: live, admin-toggleable flag
      if (!dentistryLive) {
        title = `${t.title} — Coming Soon | KClinics London`;
        description = `Coming soon to KClinics, Islington — ${t.title.toLowerCase()}. Not bookable yet; join the waiting list and be first to know when our dentistry suite opens.`;
      }
    }
    return pageMeta({ title, description, path: `/${t.slug}`, keywords: t.keywords, ownOgImage: true });
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
    // BLD-1483: dentistry pages stay indexed pre-launch (BLD-1250) with
    // "Coming Soon" framing in the on-page meta above, but serviceLd() was
    // still fed a live price -- so the Offer node claimed InStock availability
    // and a bookable /book URL even when dentistryLive is false. Withhold the
    // price here the same way generateMetadata already withholds the title, so
    // the JSON-LD never advertises a service the clinic can't yet deliver.
    let dentistryLive = true;
    if (t.category === 'dentistry') {
      const { getSiteConfig } = await import('@/lib/site-config');
      ({ dentistryLive } = await getSiteConfig());
    }
    // BLD-1513: t.onRequest forces TreatmentTemplate to a "Coming Soon"/
    // enquiry-only UI (components/treatment/TreatmentTemplate.tsx) for
    // treatments not yet bookable online, but serviceLd() was still fed a
    // live price -- so the Offer node claimed InStock availability and a
    // bookable /book URL even though the page itself says "enquire". Withhold
    // the price here too, the same way dentistryLive already does above.
    const ldPricePence = (t.category === 'dentistry' && !dentistryLive) || t.onRequest ? null : fromPence;
    // serviceLd() returns an array (Procedure + Offer/Service) when pricePence is
    // set, a single object otherwise — always spread so it never nests as one
    // element (PRJ-1060.1).
    const sld = serviceLd({ name: t.title, description: t.metaDescription, path: `/${t.slug}`, category: t.category, pricePence: ldPricePence, invasiveness: t.invasiveness });
    return (
      <>
        <JsonLd
          data={[
            ...(Array.isArray(sld) ? sld : [sld]),
            ...(t.faqs.length ? [faqLd(t.faqs)] : []), // never emit an empty FAQPage
            breadcrumbLd([{ name: 'Home', path: '/' }, { name: categoryLabel, path: categoryHref }, { name: t.title, path: `/${t.slug}` }]),
          ]}
        />
        {/* BLD-1251: a health-sensitive page (all dentistry, intimate/medical
            aesthetics) still fires its consent-gated view event, but with the
            label generalised to the category and no price — Meta/GA4 never
            receive "Dentures"/"Intimate Rejuvenation" tied to an ad profile.
            Non-sensitive treatments keep full per-treatment granularity. */}
        {adSensitiveTreatment(t) ? (
          <ViewItemTracker id={t.category} name={t.category === 'dentistry' ? 'Dentistry treatment' : 'Aesthetics treatment'} category={t.category} />
        ) : (
          <ViewItemTracker id={t.slug} name={t.title} category={t.category} valuePence={fromPence ?? 0} />
        )}
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
