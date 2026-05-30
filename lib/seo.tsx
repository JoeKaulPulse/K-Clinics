import type { Metadata } from 'next';
import { site } from './site';

const base = site.url;

/** Build per-page metadata with sensible premium defaults + OG/Twitter. */
export function pageMeta({
  title,
  description,
  path = '/',
  keywords,
}: {
  title: string;
  description: string;
  path?: string;
  keywords?: string[];
}): Metadata {
  const url = `${base}${path}`;
  const fullTitle = path === '/' ? title : `${title}`;
  return {
    title: fullTitle,
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
      images: [{ url: `${base}/opengraph-image`, width: 1200, height: 630, alt: site.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [`${base}/opengraph-image`],
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
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: site.ratingValue,
      reviewCount: site.reviewCount,
    },
  };
}

export function serviceLd({
  name,
  description,
  path,
  category,
}: {
  name: string;
  description: string;
  path: string;
  category: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'MedicalProcedure',
    name,
    description,
    url: `${base}${path}`,
    category,
    provider: { '@id': `${base}/#clinic` },
    areaServed: { '@type': 'City', name: 'London' },
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

/** Renders a JSON-LD <script> tag. */
export function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
