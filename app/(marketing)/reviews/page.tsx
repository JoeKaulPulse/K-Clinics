import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { Stagger, StaggerItem, Reveal } from '@/components/motion/Reveal';
import { BookingButtons } from '@/components/booking/BookingButtons';
import { reviews } from '@/lib/reviews';
import { site } from '@/lib/site';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Client Reviews & Testimonials | K Clinics London',
  description:
    `Read why clients rate K Clinics ${site.ratingValue}/5. Real stories from our Islington clinic across laser, skin, body and aesthetic dentistry treatments.`,
  path: '/reviews',
  keywords: ['K Clinics reviews', 'aesthetic clinic reviews London', 'dentist reviews Islington'],
});

function reviewsLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: site.name,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: site.ratingValue,
      reviewCount: site.reviewCount,
    },
    review: reviews.map((r) => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: r.name },
      reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5' },
      reviewBody: r.quote,
      itemReviewed: { '@type': 'MedicalProcedure', name: r.treatment },
    })),
  };
}

export default function ReviewsPage() {
  return (
    <>
      <JsonLd data={[reviewsLd(), breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Reviews', path: '/reviews' }])]} />
      <PageHero
        eyebrow={`Rated ${site.ratingValue}/5 · ${site.reviewCount}+ reviews`}
        title="Loved by London, in their words."
        lede="The truest measure of our work is how our clients feel when they leave — and how often they return. Here are a few of their stories."
        gradient={['#a98a6d', '#7b6a5d']}
      >
        <BookingButtons />
      </PageHero>

      <section className="container-lux section">
        <Stagger className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r) => (
            <StaggerItem key={r.name}>
              <figure className="flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 transition-all duration-700 [transition-timing-function:var(--ease-lux)] hover:-translate-y-1.5 hover:bg-[var(--color-porcelain)] hover:shadow-[var(--shadow-lift)]">
                <div className="mb-4 flex text-[var(--color-gold)]" aria-hidden>
                  {Array.from({ length: 5 }).map((_, s) => (
                    <svg key={s} viewBox="0 0 20 20" className="h-4 w-4 fill-current">
                      <path d="M10 1l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9 4.8 17.2l1-5.8L1.5 7.3l5.9-.9z" />
                    </svg>
                  ))}
                </div>
                <blockquote className="flex-1 font-[family-name:var(--font-display)] text-xl leading-snug">
                  “{r.quote}”
                </blockquote>
                <figcaption className="mt-6 text-sm text-[var(--color-stone)]">
                  <span className="font-medium text-[var(--color-ink)]">{r.name}</span> — {r.treatment}
                  {r.location ? `, ${r.location}` : ''}
                </figcaption>
              </figure>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal>
          <p className="mt-12 text-center text-sm text-[var(--color-stone)]">
            Representative testimonials. Verified client reviews available on request and across our booking partners.
          </p>
        </Reveal>
      </section>
    </>
  );
}
