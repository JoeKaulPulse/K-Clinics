import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { Stagger, StaggerItem, Reveal } from '@/components/motion/Reveal';
import { BookingButtons } from '@/components/booking/BookingButtons';
import { Stars } from '@/components/ui/Stars';
import { site } from '@/lib/site';
import { pageMeta, JsonLd, breadcrumbLd, aggregateRatingLd } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMeta({
  title: 'Client Reviews & Testimonials | KClinics London',
  description:
    'Real, verified reviews from KClinics, Islington — across laser, skin, body and aesthetic dentistry. We only ever publish 5-star reviews left by genuine clients.',
  path: '/reviews',
  keywords: ['KClinics reviews', 'aesthetic clinic reviews London', 'dentist reviews Islington'],
});

export const revalidate = 300; // ISR: cached, revalidated in the background

export default async function ReviewsPage() {
  const { getReviewAggregate } = await import('@/lib/reviews-aggregate');
  const aggregate = await getReviewAggregate();
  const cards = aggregate?.cards ?? [];

  const reviewsLd = aggregate
    ? [
        aggregateRatingLd({ average: aggregate.average, count: aggregate.count }),
        ...cards.slice(0, 12).map((r) => ({
          '@context': 'https://schema.org',
          '@type': 'Review',
          author: { '@type': 'Person', name: r.author },
          reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5' },
          reviewBody: r.body,
          ...(r.treatment ? { itemReviewed: { '@type': 'MedicalProcedure', name: r.treatment } } : {}),
        })),
      ]
    : [];

  return (
    <>
      <JsonLd data={[...reviewsLd, breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Reviews', path: '/reviews' }])]} />
      <PageHero
        eyebrow={aggregate ? `${aggregate.average.toFixed(1)}/5 · ${aggregate.count} verified review${aggregate.count === 1 ? '' : 's'}` : 'Reviews'}
        title="Honest words from real clients."
        lede="The truest measure of our work is how our clients feel when they leave. Every review here is genuine — left by a verified client and published only with their permission."
        gradient={['#a98a6d', '#7b6a5d']}
      >
        <BookingButtons />
      </PageHero>

      {aggregate && aggregate.count > 0 && (
        <section className="border-b border-[var(--color-line)] bg-[var(--color-bone)]">
          <div className="container-lux flex flex-wrap items-center justify-center gap-x-10 gap-y-4 py-10 text-center">
            <div className="flex items-center gap-3">
              <Stars rating={aggregate.average} size="h-6 w-6" />
              <span className="font-[family-name:var(--font-display)] text-3xl text-gold-gradient">{aggregate.average.toFixed(1)}</span>
            </div>
            <p className="text-sm text-[var(--color-stone)]">
              From {aggregate.count} verified review{aggregate.count === 1 ? '' : 's'}
              {aggregate.sources.includes('google') ? ' across Google and our own clients' : ' from our own clients'}.
            </p>
          </div>
        </section>
      )}

      <section className="container-lux section">
        {cards.length === 0 ? (
          <Reveal>
            <div className="mx-auto max-w-xl rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-10 text-center">
              <h2 className="font-[family-name:var(--font-display)] text-2xl">Our reviews, the honest way.</h2>
              <p className="mt-3 text-[var(--color-stone)]">
                We feature only genuine, verified reviews — from our own clients and from Google. As a brand-new clinic these are just beginning to come in: after your visit we’ll invite you to share your experience, and with your permission we’ll feature it here.
              </p>
              <p className="mt-3 text-sm text-[var(--color-stone)]">
                Prefer to chat first? Call <a href={site.phoneHref} className="link-underline font-medium text-[var(--color-ink)]">{site.phone}</a>.
              </p>
              <div className="mt-7 flex justify-center"><BookingButtons /></div>
            </div>
          </Reveal>
        ) : (
          <Stagger className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {cards.map((r, i) => (
              <StaggerItem key={`${r.author}-${i}`}>
                <figure className="flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 transition-all duration-700 [transition-timing-function:var(--ease-lux)] hover:-translate-y-1.5 hover:bg-[var(--color-porcelain)] hover:shadow-[var(--shadow-lift)]">
                  <div className="mb-4 flex items-center justify-between">
                    <Stars rating={5} />
                    <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--color-gold)_18%,transparent)] px-2.5 py-1 text-[0.65rem] font-medium uppercase tracking-[0.12em] text-[var(--color-ink)]">
                      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      {r.source === 'google' ? 'Google' : 'Verified'}
                    </span>
                  </div>
                  <blockquote className="flex-1 font-[family-name:var(--font-display)] text-xl leading-snug">“{r.body}”</blockquote>
                  <figcaption className="mt-6 text-sm text-[var(--color-stone)]">
                    <span className="font-medium text-[var(--color-ink)]">{r.author}</span>
                    {r.treatment ? ` — ${r.treatment}` : ''}
                  </figcaption>
                </figure>
              </StaggerItem>
            ))}
          </Stagger>
        )}

        <Reveal>
          <p className="mt-12 text-center text-sm text-[var(--color-stone)]">
            We only publish 5-star reviews that include a written comment, left by verified clients via our secure post-treatment link or our Google Business Profile. Names are shown only with the client’s explicit permission.
          </p>
        </Reveal>
      </section>
    </>
  );
}
