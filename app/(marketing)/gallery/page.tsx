import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';
import { MediaArt } from '@/components/ui/MediaArt';
import { Button, ArrowIcon } from '@/components/ui/Button';
import { treatmentImage } from '@/lib/treatment-images';
import { site } from '@/lib/site';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Before & After — Results, Shared Honestly | K Clinics London',
  description:
    'At K Clinics, Islington we share genuine client before-and-after photos privately at your consultation — only ever our own clients, only ever with their consent.',
  path: '/gallery',
  keywords: ['before after K Clinics', 'aesthetics results London', 'aesthetic dentistry results Islington'],
});

// Treatment breadth — illustrative imagery of what we offer (NOT before/after
// results). Real, consented client results are shown privately at consultation.
const SHOWCASE = [
  { slug: 'hydraglow-facial', title: 'Skin & facials' },
  { slug: 'laser-hair-removal', title: 'Laser hair removal' },
  { slug: 'veneers', title: 'Aesthetic dentistry' },
  { slug: 'smas-hifu-lifting', title: 'Non-surgical lifting' },
  { slug: 'body-contouring', title: 'Body contouring' },
  { slug: 'cosmetic-injections', title: 'Injectable artistry' },
];

export default function GalleryPage() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Before & After', path: '/gallery' }])} />
      <PageHero
        eyebrow="Before & after"
        title="Real results, shared with respect."
        lede="The best evidence of our work is how our clients feel afterwards. We show genuine before-and-after photography at your consultation — only ever our own clients, and only ever with their explicit consent."
        gradient={['#2a2420', '#a98a6d']}
      >
        <Button href="/consultation" variant="gold">Book a free consultation <ArrowIcon /></Button>
      </PageHero>

      {/* Why we do it this way */}
      <section className="container-lux section">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <Reveal>
            <p className="eyebrow mb-3">Honest by design</p>
            <h2 className="text-title">Why we don’t post a wall of photos.</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="space-y-4 text-lg leading-relaxed text-[var(--color-stone)]">
              <p>
                Before-and-after photos are personal. We believe they should only ever be shared with the client’s clear, written permission — and kept relevant to the person looking at them.
              </p>
              <p>
                So rather than publish a generic gallery, we’ll show you real, consented results from <strong className="text-[var(--color-ink)]">our own clients</strong> that match your skin, your smile and your goals — privately, during your complimentary consultation. It’s more useful, and it’s the respectful way to do it.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Treatment breadth (clearly not before/after results) */}
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
                  <div className="p-6">
                    <h3 className="font-[family-name:var(--font-display)] text-xl">{s.title}</h3>
                  </div>
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

      {/* CTA */}
      <section className="container-lux section">
        <Reveal>
          <div className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] p-8 text-center md:p-12">
            <h2 className="text-title mx-auto max-w-2xl">See results relevant to you.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-[var(--color-stone)]">
              Book a complimentary consultation and we’ll talk you through genuine, consented before-and-afters from our clients — and what’s realistically achievable for you. Prefer to talk first? Call <a href={site.phoneHref} className="link-underline font-medium text-[var(--color-ink)]">{site.phone}</a>.
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
