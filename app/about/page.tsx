import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { SectionHeading } from '@/components/ui/Section';
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';
import { GenerativeArt } from '@/components/ui/GenerativeArt';
import { Marquee } from '@/components/ui/Marquee';
import { BookingButtons } from '@/components/booking/BookingButtons';
import { site } from '@/lib/site';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'About K Clinics — Premium Aesthetics & Dentistry, Islington London',
  description:
    'Meet K Clinics: a premium Islington clinic uniting advanced aesthetics and aesthetic dentistry, built on clinical excellence, artistry and uncommon care.',
  path: '/about',
  keywords: ['about K Clinics', 'premium clinic London', 'Islington aesthetics dentistry'],
});

const values = [
  { t: 'Clinical excellence', d: 'Medical-grade technology in expert, accountable hands — never a shortcut, never a compromise.' },
  { t: 'Natural artistry', d: 'A conservative, considered aesthetic. Results that enhance, never overwhelm — unmistakably you.' },
  { t: 'Radical transparency', d: 'Honest advice, clear plans and fixed quotes. You decide, in your time, with full information.' },
  { t: 'Quiet luxury', d: 'A calm, private sanctuary where every detail is designed around your comfort and confidence.' },
];

export default function AboutPage() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'About', path: '/about' }])} />
      <PageHero
        eyebrow={`Established ${site.founded} · Islington, London`}
        title="A higher standard of care, beautifully delivered."
        lede="K Clinics was founded on a conviction that has never wavered: that exceptional results come from the rare union of clinical rigour, genuine artistry and an obsession with how people feel in our care."
        gradient={['#3f5a4e', '#161310']}
      >
        <BookingButtons />
      </PageHero>

      {/* Story */}
      <section className="container-lux grid gap-12 py-20 md:grid-cols-2 md:items-center md:py-28">
        <Reveal>
          <GenerativeArt from="#b08544" to="#3f5a4e" className="aspect-[4/5] rounded-[var(--radius-2xl)] shadow-[var(--shadow-lift)]" />
        </Reveal>
        <Reveal delay={0.1}>
          <p className="eyebrow mb-4">Our philosophy</p>
          <h2 className="text-title">Two disciplines. One pursuit of confidence.</h2>
          <div className="mt-6 space-y-4 text-lg leading-relaxed text-[var(--color-stone)]">
            <p>
              Most people meet aesthetics and dentistry as two separate worlds. We saw the connection — that a luminous complexion and a confident smile are simply two expressions of the same wellbeing.
            </p>
            <p>
              So we built a single home for both, staffed by clinicians who treat the whole person, not a checklist. The result is a more complete, more considered kind of transformation — and an experience that feels, from the first hello, entirely unlike a clinic.
            </p>
          </div>
        </Reveal>
      </section>

      {/* Values */}
      <section className="bg-[var(--color-bone)] py-20 md:py-28">
        <div className="container-lux">
          <SectionHeading eyebrow="What we stand for" title="The principles behind every result." />
          <Stagger className="mt-12 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-2">
            {values.map((v) => (
              <StaggerItem key={v.t} className="bg-[var(--color-porcelain)] p-8 md:p-10">
                <h3 className="font-[family-name:var(--font-display)] text-2xl">{v.t}</h3>
                <p className="mt-3 leading-relaxed text-[var(--color-stone)]">{v.d}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Marquee */}
      <section className="surface-ink grain border-y border-white/10 py-12">
        <Marquee items={['Precision', 'Artistry', 'Discretion', 'Excellence', 'Care', 'Confidence']} className="text-[var(--color-porcelain)]" />
      </section>

      {/* Stats */}
      <section className="container-lux py-20 md:py-28">
        <div className="grid gap-8 text-center sm:grid-cols-3">
          {[
            { k: `${new Date().getFullYear() - Number(site.founded)}+`, v: 'Years caring for London' },
            { k: `${site.reviewCount}+`, v: `Five-star reviews · ${site.ratingValue} average` },
            { k: '40+', v: 'Treatments under one roof' },
          ].map((s) => (
            <Reveal key={s.v}>
              <p className="font-[family-name:var(--font-display)] text-6xl text-gold-gradient">{s.k}</p>
              <p className="mt-2 text-[var(--color-stone)]">{s.v}</p>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
