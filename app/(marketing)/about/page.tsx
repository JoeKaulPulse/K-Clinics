import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { SectionHeading } from '@/components/ui/Section';
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';
import { MaskReveal } from '@/components/motion/MaskReveal';
import { MediaArt } from '@/components/ui/MediaArt';
import { pageImage } from '@/lib/treatment-images';
import { Marquee } from '@/components/ui/Marquee';
import { BookingButtons } from '@/components/booking/BookingButtons';
import { CountUp } from '@/components/motion/CountUp';
import { site } from '@/lib/site';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'About KClinics — Premium Aesthetics & Dentistry, Islington London',
  description:
    'Meet KClinics: a premium Islington clinic uniting advanced aesthetics and aesthetic dentistry, built on clinical excellence, artistry and uncommon care.',
  path: '/about',
  keywords: ['about KClinics', 'premium clinic London', 'Islington aesthetics dentistry'],
});

// Authentic pillars from the existing KClinics site.
const values = [
  { t: 'Innovation', d: 'We employ the most recent equipment in aesthetic medicine to provide results that are safe, efficient and long-lasting.' },
  { t: 'Professionalism', d: 'Our team consists of certified specialists with years of experience, adhering to the highest standards of care.' },
  { t: 'Personalised approach', d: 'Each procedure is customised to your particular needs and preferences, to achieve the best possible results.' },
  { t: 'Quiet luxury', d: 'Cutting-edge technology meets expert care in an inclusive, luxurious and welcoming environment built around you.' },
];

export default function AboutPage() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'About', path: '/about' }])} />
      <PageHero
        eyebrow={`Established ${site.founded} · Islington, London`}
        title="Redefining cosmetic dermatology and dentistry."
        lede="Luxury treatments, perfect smiles and world-class providers. At KClinics, we believe aesthetic medicine should feel empowering, welcoming and simple to navigate — for every skin tone, gender and lifestyle."
        gradient={['#7b6a5d', '#2a2420']}
      >
        <BookingButtons />
      </PageHero>

      {/* Story */}
      <section className="container-lux grid gap-12 py-20 md:grid-cols-2 md:items-center md:py-28">
        <MaskReveal className="aspect-[4/5] rounded-[var(--radius-2xl)] shadow-[var(--shadow-lift)]">
          <MediaArt src={pageImage('about')} from="#a98a6d" to="#7b6a5d" alt="KClinics, Islington" className="h-full w-full" />
        </MaskReveal>
        <Reveal delay={0.1}>
          <p className="eyebrow mb-4">Your natural beauty, our mission</p>
          <h2 className="text-title">Care, customised entirely around you.</h2>
          <div className="mt-6 space-y-4 text-lg leading-relaxed text-[var(--color-stone)]">
            <p>
              We believe beauty is more than your appearance in the mirror. Our mission is to emphasise your natural beauty using innovative technology and a professional approach — creating a personalised care plan for every client that delivers a feeling of harmony, confidence and beauty.
            </p>
            <p>
              The goal of KClinics is to make high-quality, customised care accessible to everyone. Whether you’re looking for a subtle improvement or a life-changing outcome, our clinics are made to make you feel appreciated and cared for — the focus is always on you: your goals, your journey, your beauty.
            </p>
          </div>
        </Reveal>
      </section>

      {/* Values */}
      <section className="bg-[var(--color-bone)] section">
        <div className="container-lux">
          <SectionHeading eyebrow="What we stand for" title="The principles behind every result." />
          <Stagger className="mt-[var(--space-block)] grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-2">
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
      <section className="container-lux section">
        <div className="grid gap-8 text-center sm:grid-cols-3">
          {[
            { k: `${new Date().getFullYear() - Number(site.founded)}+`, v: 'Years caring for London' },
            { k: `${site.reviewCount}+`, v: `Five-star reviews · ${site.ratingValue} average` },
            { k: '40+', v: 'Treatments under one roof' },
          ].map((s) => (
            <Reveal key={s.v}>
              <CountUp value={s.k} className="block font-[family-name:var(--font-display)] text-6xl text-gold-gradient" />
              <p className="mt-2 text-[var(--color-stone)]">{s.v}</p>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
