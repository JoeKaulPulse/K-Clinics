import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal } from '@/components/motion/Reveal';
import { BeforeAfter } from '@/components/ui/BeforeAfter';
import { BeforeAfterGallery } from '@/components/gallery/BeforeAfterGallery';
import { Button, ArrowIcon } from '@/components/ui/Button';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Before & After Gallery | K Clinics London',
  description:
    'Real client before-and-after results from K Clinics, Islington — veneers, composite bonding, teeth whitening, aligners, braces and dentures. Tap any case to see the transformation.',
  path: '/gallery',
  keywords: ['veneers before after London', 'teeth whitening results', 'composite bonding before after', 'smile makeover gallery'],
});

export default function GalleryPage() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Before & After Gallery', path: '/gallery' }])} />
      <PageHero
        eyebrow="Before & after"
        title="Real results, real smiles."
        lede="A selection of genuine client transformations across our aesthetic dentistry treatments. Tap any case to see the full before-and-after — and picture what’s possible for you."
        gradient={['#2a2420', '#a98a6d']}
      />

      {/* Interactive featured before/after */}
      <section className="container-lux section">
        <Reveal>
          <BeforeAfter
            beforeSrc="/hero/result-before.webp"
            afterSrc="/hero/result-after.webp"
            labelBefore="Before"
            labelAfter="After"
            className="aspect-[16/10] w-full shadow-[var(--shadow-lift)] md:aspect-[16/8]"
          />
          <p className="mt-4 text-center text-xs text-[var(--color-stone)]">
            Drag to reveal. Representative result — individual outcomes vary with each client and treatment plan.
          </p>
        </Reveal>
      </section>

      {/* Real case gallery with modals */}
      <section className="bg-[var(--color-bone)] section">
        <div className="container-lux">
          <Reveal><p className="eyebrow mb-3">The gallery</p><h2 className="text-title">Transformations, case by case.</h2></Reveal>
          <div className="mt-[var(--space-block)]">
            <BeforeAfterGallery />
          </div>
        </div>
      </section>

      {/* Consent / honesty note + CTA */}
      <section className="container-lux section">
        <Reveal>
          <div className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] p-8 text-center md:p-12">
            <h2 className="text-title mx-auto max-w-2xl">Your transformation starts with a conversation.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-[var(--color-stone)]">
              Every case here is a real client, shared with permission. Results vary from person to person — at your complimentary consultation we’ll assess your goals honestly and show you what’s realistically achievable for you.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button href="/consultation" variant="gold">Book a free consultation <ArrowIcon /></Button>
              <Button href="/dentistry" variant="outline">Explore dentistry</Button>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
