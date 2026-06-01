import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { Stagger, StaggerItem, Reveal } from '@/components/motion/Reveal';
import { BookingButtons } from '@/components/booking/BookingButtons';
import { reviews as staticReviews } from '@/lib/reviews';
import { site } from '@/lib/site';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Client Reviews & Testimonials | K Clinics London',
  description:
    `Read why clients rate K Clinics ${site.ratingValue}/5. Real, verified stories from our Islington clinic across laser, skin, body and aesthetic dentistry treatments.`,
  path: '/reviews',
  keywords: ['K Clinics reviews', 'aesthetic clinic reviews London', 'dentist reviews Islington'],
});

export const dynamic = 'force-dynamic';

type Card = { name: string; treatment: string; quote: string; location?: string; rating?: number; title?: string; date?: string; verified?: boolean };

function Stars({ n = 5 }: { n?: number }) {
  return (
    <div className="flex text-[var(--color-gold)]" aria-label={`${n} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, s) => (
        <svg key={s} viewBox="0 0 20 20" className={`h-4 w-4 ${s < n ? 'fill-current' : 'fill-[var(--color-line)]'}`} aria-hidden>
          <path d="M10 1l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9 4.8 17.2l1-5.8L1.5 7.3l5.9-.9z" />
        </svg>
      ))}
    </div>
  );
}

export default async function ReviewsPage() {
  const { publishedReviews, reviewStats } = await import('@/lib/review-system');
  const [live, stats] = await Promise.all([publishedReviews(12), reviewStats()]);

  // Live CRM reviews lead; representative testimonials fill out the wall.
  const cards: Card[] = [
    ...live.map((r) => ({ ...r, verified: true })),
    ...staticReviews.map((r) => ({ ...r, rating: 5 })),
  ];

  const ratingValue = stats?.average ? stats.average.toFixed(1) : site.ratingValue;
  const reviewCount = stats?.count ? `${stats.count}` : `${site.reviewCount}+`;

  const reviewsLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: site.name,
    aggregateRating: { '@type': 'AggregateRating', ratingValue, reviewCount: stats?.count || site.reviewCount },
    review: cards.slice(0, 12).map((r) => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: r.name },
      reviewRating: { '@type': 'Rating', ratingValue: String(r.rating || 5), bestRating: '5' },
      reviewBody: r.quote,
      itemReviewed: { '@type': 'MedicalProcedure', name: r.treatment },
    })),
  };

  return (
    <>
      <JsonLd data={[reviewsLd, breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Reviews', path: '/reviews' }])]} />
      <PageHero
        eyebrow={`Rated ${ratingValue}/5 · ${reviewCount} reviews`}
        title="Loved by London, in their words."
        lede="The truest measure of our work is how our clients feel when they leave — and how often they return. These stories come straight from the people we’ve cared for."
        gradient={['#a98a6d', '#7b6a5d']}
      >
        <BookingButtons />
      </PageHero>

      {/* Trust strip */}
      <section className="border-b border-[var(--color-line)] bg-[var(--color-bone)]">
        <div className="container-lux grid gap-6 py-10 text-center sm:grid-cols-3">
          {[
            { v: `${ratingValue}/5`, l: 'Average client rating' },
            { v: reviewCount, l: 'Reviews & counting' },
            { v: '9 in 10', l: 'Clients return or refer' },
          ].map((s) => (
            <Reveal key={s.l}>
              <div>
                <p className="font-[family-name:var(--font-display)] text-4xl text-gold-gradient">{s.v}</p>
                <p className="mt-1 text-sm text-[var(--color-stone)]">{s.l}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="container-lux section">
        <Stagger className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((r, i) => (
            <StaggerItem key={`${r.name}-${i}`}>
              <figure className="flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 transition-all duration-700 [transition-timing-function:var(--ease-lux)] hover:-translate-y-1.5 hover:bg-[var(--color-porcelain)] hover:shadow-[var(--shadow-lift)]">
                <div className="mb-4 flex items-center justify-between">
                  <Stars n={r.rating || 5} />
                  {r.verified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--color-gold)_18%,transparent)] px-2.5 py-1 text-[0.65rem] font-medium uppercase tracking-[0.12em] text-[var(--color-ink)]">
                      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      Verified
                    </span>
                  )}
                </div>
                {r.title && <p className="mb-2 font-[family-name:var(--font-display)] text-lg leading-snug">{r.title}</p>}
                <blockquote className={`flex-1 leading-relaxed ${r.title ? 'text-[var(--color-stone)]' : 'font-[family-name:var(--font-display)] text-xl leading-snug text-[var(--color-ink)]'}`}>
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
            Verified reviews are left by clients after their visit via our secure post-treatment link. Representative testimonials are clearly part of our wider client feedback.
          </p>
        </Reveal>
      </section>
    </>
  );
}
