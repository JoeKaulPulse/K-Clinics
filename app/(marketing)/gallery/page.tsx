import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';
import { BeforeAfter } from '@/components/ui/BeforeAfter';
import { MediaArt } from '@/components/ui/MediaArt';
import { Button, ArrowIcon } from '@/components/ui/Button';
import { treatmentImage } from '@/lib/treatment-images';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Before & After Gallery | K Clinics London',
  description:
    'See the kind of results K Clinics, Islington delivers across laser, skin, body and aesthetic dentistry. Full, consented client before-and-afters are shared privately at your consultation.',
  path: '/gallery',
  keywords: ['before after aesthetics London', 'laser results', 'veneers before after', 'skin treatment results'],
});

const SHOWCASE = [
  { slug: 'hydraglow-facial', title: 'Skin & facials', text: 'Brighter, smoother, more even skin.' },
  { slug: 'laser-hair-removal', title: 'Laser hair removal', text: 'Lasting reduction, gently done.' },
  { slug: 'veneers', title: 'Aesthetic dentistry', text: 'Natural-looking smile design.' },
  { slug: 'smas-hifu-lifting', title: 'Non-surgical lifting', text: 'Subtle definition, no downtime.' },
  { slug: 'body-contouring', title: 'Body contouring', text: 'Smoother, more sculpted contours.' },
  { slug: 'cosmetic-injections', title: 'Injectable artistry', text: 'Refreshed, never overdone.' },
];

export default function GalleryPage() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Before & After Gallery', path: '/gallery' }])} />
      <PageHero
        eyebrow="Before & after"
        title="Results that speak softly."
        lede="The best testament to our work is the difference it makes. Drag the slider to see a sample result — and we’ll walk you through full, consented client cases relevant to your goals at your consultation."
        gradient={['#2a2420', '#a98a6d']}
      />

      {/* Featured interactive before/after */}
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
            Representative result. Individual outcomes vary with skin type, lifestyle and treatment plan.
          </p>
        </Reveal>
      </section>

      {/* What we treat — imagery, honestly labelled */}
      <section className="bg-[var(--color-bone)] section">
        <div className="container-lux">
          <Reveal><p className="eyebrow mb-3">Across the menu</p><h2 className="text-title">The transformations we’re known for.</h2></Reveal>
          <Stagger className="mt-[var(--space-block)] grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {SHOWCASE.map((s, i) => (
              <StaggerItem key={s.slug}>
                <div className="group overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <MediaArt src={treatmentImage(s.slug)} from="#a98a6d" to="#7b6a5d" seed={i} alt={s.title} className="h-full w-full transition-transform duration-[1.6s] [transition-timing-function:var(--ease-lux)] group-hover:scale-[1.05]" />
                  </div>
                  <div className="p-6">
                    <h3 className="font-[family-name:var(--font-display)] text-xl">{s.title}</h3>
                    <p className="mt-1.5 text-sm text-[var(--color-stone)]">{s.text}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Consent / honesty note + CTA */}
      <section className="container-lux section">
        <Reveal>
          <div className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] p-8 text-center md:p-12">
            <h2 className="text-title mx-auto max-w-2xl">Real client photos, shared with care.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-[var(--color-stone)]">
              We only ever share client before-and-after photographs with explicit, written consent — and we keep them relevant to your treatment, your skin and your goals. Because of that, we show full case photography privately during your consultation rather than publishing it here.
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
