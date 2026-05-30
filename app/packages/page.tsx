import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/ui/PageHero';
import { GenerativeArt } from '@/components/ui/GenerativeArt';
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';
import { ArrowIcon } from '@/components/ui/Button';
import { packages } from '@/lib/packages';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Treatment Packages & Programmes in London | K Clinics',
  description:
    'Curated treatment packages at K Clinics, Islington — Total Rejuvenation, Perfect Skin, Smooth & Slim and Ultimate Hair-Free programmes for transformative, lasting results.',
  path: '/packages',
  keywords: ['treatment packages London', 'skin programme London', 'body sculpting package', 'laser hair removal package'],
});

export default function PackagesPage() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Packages', path: '/packages' }])} />
      <PageHero
        eyebrow="Curated programmes"
        title="Signature packages, designed to transform."
        lede="Our most considered work happens over time. Each programme sequences complementary treatments into a single, value-led journey toward a defined result."
        gradient={['#b08544', '#3a2730']}
      />

      <section className="container-lux section">
        <Stagger className="grid gap-8">
          {packages.map((p, i) => (
            <StaggerItem key={p.slug}>
              <Link
                href={`/packages/${p.slug}`}
                className="group grid overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-line)] transition-all duration-700 hover:shadow-[var(--shadow-lift)] md:grid-cols-[1fr_1.2fr]"
              >
                <GenerativeArt
                  from={p.gradient[0]}
                  to={p.gradient[1]}
                  seed={i}
                  className="min-h-[14rem] transition-transform duration-[1.6s] [transition-timing-function:var(--ease-lux)] group-hover:scale-105"
                />
                <div className="flex flex-col justify-center p-8 md:p-12">
                  <p className="eyebrow mb-3">{p.subtitle}</p>
                  <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl">{p.name}</h2>
                  <p className="mt-4 max-w-xl text-[var(--color-stone)]">{p.description}</p>
                  <span className="mt-6 inline-flex items-center gap-2 font-medium text-[var(--color-gold)]">
                    View programme <ArrowIcon />
                  </span>
                </div>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </section>
    </>
  );
}
