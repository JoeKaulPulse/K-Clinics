import type { Metadata } from 'next';
import { site } from './site';

const base = site.url;

/**
 * Build per-page metadata with premium defaults + per-page OG/Twitter, then
 * merge any admin SEO override (title/description/canonical/keyword/OG image/
 * noindex) from the PageSeo table over the code defaults. Async because it reads
 * the override; the DB call is best-effort and never throws. Callers use it from
 * `generateMetadata` (static pages: `export const generateMetadata = () => pageMeta({…})`).
 */
export async function pageMeta({
  title,
  description,
  path = '/',
  keywords,
  ownOgImage = false,
  noindex = false,
}: {
  title: string;
  description: string;
  path?: string;
  keywords?: string[];
  /** Keep this page out of the index (thin/transactional pages). */
  noindex?: boolean;
  /** When true, defer to a route's own `opengraph-image.tsx` instead of the
   *  dynamic /og card — unless an admin override supplies a custom OG image. */
  ownOgImage?: boolean;
}): Promise<Metadata> {
  // Best-effort admin override (no-op without a DB / in the client bundle).
  let ov: { title?: string | null; description?: string | null; canonical?: string | null; focusKeyword?: string | null; ogImage?: string | null; noindex?: boolean } | null = null;
  try {
    const { getPageOverride } = await import('./seo-audit');
    ov = await getPageOverride(path);
  } catch { /* overrides are best-effort */ }

  const fullTitle = ov?.title || title;
  const desc = ov?.description || description;
  const url = `${base}${path}`;
  const canonical = ov?.canonical || url;
  const finalKeywords = ov?.focusKeyword && !(keywords || []).includes(ov.focusKeyword) ? [ov.focusKeyword, ...(keywords || [])] : keywords;

  // Per-page social card: feed the page's own heading + description into the
  // dynamic /og generator so every shared link previews uniquely & on-brand.
  const customOg = ov?.ogImage ? (/^https?:\/\//.test(ov.ogImage) ? ov.ogImage : `${base}${ov.ogImage}`) : null;
  const ogHeading = fullTitle.split(' | ')[0];
  const ogUrl = customOg || `${base}/og?title=${encodeURIComponent(ogHeading)}&tag=${encodeURIComponent(desc)}`;
  // Use the dynamic/custom card unless the route owns a bespoke opengraph-image
  // (and no custom override is set).
  const useImage = !!customOg || !ownOgImage;
  const images = useImage ? [{ url: ogUrl, width: 1200, height: 630, alt: fullTitle }] : undefined;

  return {
    // metaTitles already carry the brand, so bypass the layout's title template.
    title: { absolute: fullTitle },
    description: desc,
    keywords: finalKeywords,
    alternates: { canonical },
    ...((ov?.noindex || noindex) ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      type: 'website',
      url,
      siteName: site.name,
      title: fullTitle,
      description: desc,
      locale: site.locale,
      ...(images ? { images } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: desc,
      ...(images ? { images: [ogUrl] } : {}),
    },
  };
}

// ── JSON-LD builders ─────────────────────────────────────────────────────────

export function organizationLd() {
  return {
    '@context': 'https://schema.org',
    '@type': ['MedicalClinic', 'Dentist', 'HealthAndBeautyBusiness'],
    '@id': `${base}/#clinic`,
    name: site.name,
    legalName: site.legalName,
    url: base,
    telephone: site.phone,
    email: site.email,
    image: `${base}/opengraph-image`,
    priceRange: '££–£££',
    description: site.description,
    foundingDate: site.founded,
    address: {
      '@type': 'PostalAddress',
      streetAddress: site.address.street,
      addressLocality: site.address.locality,
      addressRegion: site.address.region,
      postalCode: site.address.postalCode,
      addressCountry: site.address.country,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: site.geo.latitude,
      longitude: site.geo.longitude,
    },
    openingHoursSpecification: site.hours
      .filter((h) => h.open !== 'Closed')
      .map((h) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: `https://schema.org/${h.day}`,
        opens: h.open,
        closes: h.close,
      })),
    sameAs: Object.values(site.social),
    // No aggregateRating here — it must reflect real reviews only. When real
    // reviews exist, aggregateRatingLd() is injected on the relevant pages.
    areaServed: londonAreas(),
    currenciesAccepted: 'GBP',
    paymentAccepted: 'Cash, Credit Card, Debit Card, Apple Pay, Google Pay',
    medicalSpecialty: ['Dermatology', 'CosmeticDentistry', 'PlasticSurgery'],
    availableService: [
      { '@type': 'MedicalProcedure', name: 'Laser Hair Removal' },
      { '@type': 'MedicalProcedure', name: 'Anti-Wrinkle Injections' },
      { '@type': 'MedicalProcedure', name: 'Dermal Fillers' },
      { '@type': 'MedicalProcedure', name: 'HIFU Non-Surgical Lifting' },
      { '@type': 'Dentistry', name: 'Porcelain Veneers' },
      { '@type': 'Dentistry', name: 'Teeth Whitening' },
      { '@type': 'Dentistry', name: 'Dental Implants' },
    ],
    knowsAbout: [
      'Aesthetic medicine',
      'Cosmetic dentistry',
      'Laser skin treatments',
      'Non-surgical facial rejuvenation',
      'Injectable treatments',
    ],
    hasMap: site.mapLink,
    isAcceptingNewPatients: true,
  };
}

export function serviceLd({
  name,
  description,
  path,
  category,
  pricePence,
  bodyLocation,
}: {
  name: string;
  description: string;
  path: string;
  category: string;
  pricePence?: number | null;
  bodyLocation?: string;
}) {
  const proc: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': category === 'dentistry' ? 'Dentistry' : 'MedicalProcedure',
    name,
    description,
    url: `${base}${path}`,
    category,
    procedureType: { '@type': 'MedicalProcedureType', name: 'Noninvasive procedure' },
    provider: { '@id': `${base}/#clinic` },
    areaServed: londonAreas(),
  };
  if (bodyLocation) proc.bodyLocation = bodyLocation;
  // Service + Offer wrapper enables rich price snippets & "from £X" in results.
  if (pricePence && pricePence > 0) {
    return [
      proc,
      {
        '@context': 'https://schema.org',
        '@type': 'Service',
        name,
        serviceType: name,
        url: `${base}${path}`,
        provider: { '@id': `${base}/#clinic` },
        areaServed: londonAreas(),
        offers: {
          '@type': 'Offer',
          price: (pricePence / 100).toFixed(2),
          priceCurrency: 'GBP',
          availability: 'https://schema.org/InStock',
          url: `${base}/book`,
          priceSpecification: {
            '@type': 'PriceSpecification',
            price: (pricePence / 100).toFixed(2),
            priceCurrency: 'GBP',
            valueAddedTaxIncluded: true,
          },
        },
      },
    ];
  }
  return proc;
}

/** Local areas KClinics serves — strengthens "near me" / borough GEO ranking. */
export function londonAreas() {
  return [
    { '@type': 'City', name: 'London' },
    ...[
      'Islington',
      'Clerkenwell',
      'Angel',
      'Shoreditch',
      'Farringdon',
      'Old Street',
      'Barbican',
      'City of London',
      'Hoxton',
      'Finsbury',
    ].map((name) => ({ '@type': 'Place', name })),
  ];
}

/** WebSite node with a sitelinks search box — eligible for the search action. */
export function websiteLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${base}/#website`,
    url: base,
    name: site.name,
    inLanguage: 'en-GB',
    publisher: { '@id': `${base}/#clinic` },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${base}/treatments?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

/** Real AggregateRating node, tied to the clinic. Only emit when there are
 *  genuine reviews — never with hard-coded numbers. */
export function aggregateRatingLd({ average, count }: { average: number; count: number }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'AggregateRating',
    itemReviewed: { '@type': 'MedicalClinic', name: site.name, '@id': `${base}/#clinic` },
    ratingValue: average.toFixed(1),
    reviewCount: String(count),
    bestRating: '5',
    worstRating: '1',
  };
}

/** A single review snippet, for embedding under a service/clinic node. */
export function reviewLd(r: { author: string; rating: number; body: string; date?: string }) {
  return {
    '@type': 'Review',
    reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 },
    author: { '@type': 'Person', name: r.author },
    reviewBody: r.body,
    ...(r.date ? { datePublished: r.date } : {}),
  };
}

/** Course schema for K Academy training pages (rich-result eligible). */
export function courseLd(c: { title: string; description: string; path: string; pricePence?: number | null; durationText?: string | null }) {
  const o: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: c.title,
    description: c.description,
    url: `${base}${c.path}`,
    provider: { '@type': 'Organization', name: 'K Academy', sameAs: base },
    hasCourseInstance: [{
      '@type': 'CourseInstance',
      courseMode: 'Blended',
      ...(c.durationText ? { courseWorkload: c.durationText } : {}),
      location: { '@type': 'Place', name: 'K Academy', address: { '@type': 'PostalAddress', addressLocality: site.address.locality, addressRegion: site.address.region, addressCountry: 'GB' } },
    }],
  };
  if (c.pricePence && c.pricePence > 0) {
    o.offers = { '@type': 'Offer', category: 'Tuition', price: (c.pricePence / 100).toFixed(2), priceCurrency: 'GBP', url: `${base}${c.path}`, availability: 'https://schema.org/InStock' };
  }
  return o;
}

/** Price-list catalogue → OfferCatalog of priced Services (rich price results
 *  & strong grounding for AI shopping/answer engines). Prices are in GBP. */
export function offerCatalogLd(items: { name: string; price: number }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'OfferCatalog',
    name: `${site.name} — Price List`,
    url: `${base}/pricing`,
    provider: { '@id': `${base}/#clinic` },
    itemListElement: items.map((it, i) => ({
      '@type': 'Offer',
      position: i + 1,
      itemOffered: { '@type': 'Service', name: it.name, provider: { '@id': `${base}/#clinic` } },
      price: it.price.toFixed(2),
      priceCurrency: 'GBP',
      availability: 'https://schema.org/InStock',
      url: `${base}/book`,
    })),
  };
}

/** Ordered ItemList of links — exposes a hub page's contents (treatment menu,
 *  etc.) to search & AI as a structured, crawlable list. */
export function itemListLd(name: string, items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      url: `${base}${it.path}`,
    })),
  };
}

export function faqLd(faqs: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `${base}${it.path}`,
    })),
  };
}

/** Article / blog post schema for the journal. */
export function articleLd(a: {
  title: string;
  description: string;
  path: string;
  published: string;
  updated?: string;
  image?: string;
  keywords?: string[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    description: a.description,
    url: `${base}${a.path}`,
    mainEntityOfPage: `${base}${a.path}`,
    datePublished: a.published,
    dateModified: a.updated || a.published,
    image: a.image ? `${base}${a.image}` : `${base}/opengraph-image`,
    keywords: a.keywords?.join(', '),
    author: { '@type': 'Organization', name: site.name, url: base },
    publisher: { '@id': `${base}/#clinic` },
  };
}

/** Renders a JSON-LD <script> tag. The JSON is escaped so attacker-controlled
 *  content (e.g. a review body) can't break out of the <script> context — a
 *  stored-XSS guard, since JSON.stringify alone doesn't escape < / > / &. */
export function JsonLd({ data }: { data: object | object[] }) {
  const json = JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
