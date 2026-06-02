import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';
import { MediaArt } from '@/components/ui/MediaArt';
import { PublicGallery } from '@/components/gallery/PublicGallery';
import { Button, ArrowIcon } from '@/components/ui/Button';
import { treatmentImage } from '@/lib/treatment-images';
import { site } from '@/lib/site';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Before & After Gallery | K Clinics London',
  description:
    'Real client before-and-after results from K Clinics, Islington — published only with the client’s consent. Drag any case to reveal the transformation.',
  path: '/gallery',
  keywords: ['before after K Clinics', 'aesthetics results London', 'aesthetic dentistry results Islington'],
});

export const revalidate = 120; // ISR: cached, revalidated in the background

// Treatment breadth — illustrative imagery of what we offer (NOT before/after
// results). Used only as the honest fallback before any real cases are added.
const SHOWCASE = [
  { slug: 'hydraglow-facial', title: 'Skin & facials' },
  { slug: 'laser-hair-removal', title: 'Laser hair removal' },
  { slug: 'veneers', title: 'Aesthetic dentistry' },
  { slug: 'smas-hifu-lifting', title: 'Non-surgical lifting' },
  { slug: 'body-contouring', title: 'Body contouring' },
  { slug: 'cosmetic-injections', title: 'Injectable artistry' },
];

export default async function GalleryPage() {
  const { getPublishedGallery } = await import('@/lib/gallery-data');
  const items = await getPublishedGallery();
  const hasCases = items.length > 0;

  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Before & After', path: '/gallery' }])} />
      <PageHero
        eyebrow="Before & after"
        title={hasCases ? 'Real results, real clients.' : 'Real results, shared with respect.'}
        lede={hasCases
          ? 'A selection of genuine client transformations — published only with each client’s consent. Drag any case to reveal the before and after.'
          : 'The best evidence of our work is how our clients feel afterwards. We show genuine before-and-after photography at your consultation — only ever our own clients, and only ever with their explicit consent.'}
        gradient={['#2a2420', '#a98a6d']}
      >
        <Button href="/consultation" variant="gold">Book a free consultation <ArrowIcon /></Button>
      </PageHero>

      {hasCases ? (
        <section className="container-lux section">
          <PublicGallery items={items} />
        </section>
      ) : (
        <>
          {/* Honest placeholder until the clinic's own consented cases are added */}
          <section className="container-lux section">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <Reveal>
                <p className="eyebrow mb-3">Honest by design</p>
                <h2 className="text-title">Our gallery is on its way.</h2>
              </Reveal>
              <Reveal delay={0.1}>
                <div className="space-y-4 text-lg leading-relaxed text-[var(--color-stone)]">
                  <p>
                    As a new clinic, we’re building our before-and-after gallery the right way — with our own clients, and only ever with their written permission.
                  </p>
                  <p>
                    In the meantime, we’ll show you real, consented results that match your skin, your smile and your goals — privately, during your complimentary consultation.
                  </p>
                </div>
              </Reveal>
            </div>
          </section>

          <section className="bg-[var(--color-bone)] section">
            <div className="container-lux">
              <Reveal><p className="eyebrow mb-3">What we treat</p><h2 className="text-title">The transformations we focus on.</h2></Reveal>
              <Stagger className="mt-[var(--space-block)] grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {SHOWCASE.map((s, i) => (
                  <StaggerItem key={s.slug}>
                    <div className="group overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
                      <div className="relative aspect-[4/3] overflow-hidden">
                        <MediaArt src={treatmentImage(s.slug)} from="#a98a6d" to="#7b6a5d" seed={i} alt={s.title} className="h-full w-full transition-transform duration-[1.6s] [transition-timing-function:var(--ease-lux)] group-hover:scale-[1.05]" />
                      </div>
                      <div className="p-6"><h3 className="font-[family-name:var(--font-display)] text-xl">{s.title}</h3></div>
                    </div>
                  </StaggerItem>
                ))}
              </Stagger>
              <Reveal>
                <p className="mt-8 text-center text-xs text-[var(--color-stone)]">
                  Imagery above illustrates the treatments we offer — it is not a record of individual results.
                </p>
              </Reveal>
            </div>
          </section>
        </>
      )}

      {/* CTA */}
      <section className="container-lux section">
        <Reveal>
          <div className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] p-8 text-center md:p-12">
            <h2 className="text-title mx-auto max-w-2xl">See results relevant to you.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-[var(--color-stone)]">
              Book a complimentary consultation and we’ll talk you through genuine, consented before-and-afters — and what’s realistically achievable for you. Prefer to talk first? Call <a href={site.phoneHref} className="link-underline font-medium text-[var(--color-ink)]">{site.phone}</a>.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button href="/consultation" variant="gold">Book a free consultation <ArrowIcon /></Button>
              <Button href="/treatments" variant="outline">Explore treatments</Button>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
