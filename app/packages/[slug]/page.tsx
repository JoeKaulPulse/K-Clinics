import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { packages, getPackage } from '@/lib/packages';
import { getTreatment } from '@/lib/treatments';
import { PageHero } from '@/components/ui/PageHero';
import { TreatmentCard } from '@/components/ui/TreatmentCard';
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';
import { BookingButtons } from '@/components/booking/BookingButtons';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const dynamicParams = false;
export function generateStaticParams() {
  return packages.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = getPackage(slug);
  if (!p) return {};
  return pageMeta({
    title: `${p.name} Package — ${p.subtitle} | K Clinics London`,
    description: `${p.description} Available at K Clinics, Islington, London.`,
    path: `/packages/${p.slug}`,
  });
}

export default async function PackagePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getPackage(slug);
  if (!p) notFound();
  const related = p.related.map(getTreatment).filter(Boolean) as NonNullable<ReturnType<typeof getTreatment>>[];

  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', path: '/' },
          { name: 'Packages', path: '/packages' },
          { name: p.name, path: `/packages/${p.slug}` },
        ])}
      />
      <PageHero eyebrow={p.subtitle} title={p.name} lede={p.description} gradient={p.gradient}>
        <BookingButtons />
      </PageHero>

      <section className="container-lux grid gap-12 py-20 md:grid-cols-[1.2fr_0.8fr] md:py-28">
        <Reveal>
          <p className="eyebrow mb-5">What’s included</p>
          <ul className="space-y-4">
            {p.includes.map((item) => (
              <li key={item} className="flex items-start gap-4 border-b border-[var(--color-line)] pb-4">
                <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--color-ink)] text-[var(--color-gold-soft)]">
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
                    <path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="text-lg">{item}</span>
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8">
            <p className="eyebrow mb-3">Best for</p>
            <p className="font-[family-name:var(--font-display)] text-2xl leading-snug">{p.bestFor}</p>
            <div className="mt-6 border-t border-[var(--color-line)] pt-6">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]">Investment</p>
              <p className="font-[family-name:var(--font-display)] text-3xl">{p.priceFrom}</p>
              <p className="mt-2 text-sm text-[var(--color-stone)]">
                Personalised at your complimentary consultation, with flexible plans available.
              </p>
            </div>
            <div className="mt-6">
              <BookingButtons />
            </div>
          </div>
        </Reveal>
      </section>

      {related.length > 0 && (
        <section className="bg-[var(--color-bone)] py-20 md:py-28">
          <div className="container-lux">
            <Reveal>
              <p className="eyebrow mb-4">Within this programme</p>
              <h2 className="text-title">The treatments inside.</h2>
            </Reveal>
            <Stagger className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((t, i) => (
                <StaggerItem key={t.slug}>
                  <TreatmentCard t={t} index={i} />
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>
      )}
    </>
  );
}
