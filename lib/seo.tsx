import type { Metadata } from 'next';
import { site } from './site';

const base = site.url;

/** Build per-page metadata with sensible premium defaults + OG/Twitter. */
export function pageMeta({
  title,
  description,
  path = '/',
  keywords,
  ownOgImage = false,
}: {
  title: string;
  description: string;
  path?: string;
  keywords?: string[];
  /** When true, omit the site-wide OG image so a route's own
   *  `opengraph-image.tsx` file convention is used instead. */
  ownOgImage?: boolean;
}): Metadata {
  const url = `${base}${path}`;
  const fullTitle = title;
  // Per-page social card: feed the page's own heading + description into the
  // dynamic /og generator so every shared link previews uniquely & on-brand.
  // Pages with their own `opengraph-image.tsx` (treatments, journal) opt out.
  const ogHeading = title.split(' | ')[0];
  const ogUrl = `${base}/og?title=${encodeURIComponent(ogHeading)}&tag=${encodeURIComponent(description)}`;
  const images = ownOgImage ? undefined : [{ url: ogUrl, width: 1200, height: 630, alt: fullTitle }];
  return {
    // metaTitles already carry the brand, so bypass the layout's title template.
    title: { absolute: fullTitle },
    description,
    keywords,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      siteName: site.name,
      title: fullTitle,
      description,
      locale: site.locale,
      ...(images ? { images } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
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

/** Local areas K Clinics serves — strengthens "near me" / borough GEO ranking. */
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

/** Renders a JSON-LD <script> tag. */
export function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
