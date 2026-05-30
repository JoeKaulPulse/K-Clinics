import Link from 'next/link';
import type { Treatment } from '@/lib/treatments';
import { getTreatment } from '@/lib/treatments';
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';
import { WordReveal } from '@/components/motion/WordReveal';
import { GenerativeArt } from '@/components/ui/GenerativeArt';
import { TreatmentCard } from '@/components/ui/TreatmentCard';
import { FaqAccordion } from '@/components/ui/FaqAccordion';
import { Button, ArrowIcon } from '@/components/ui/Button';
import { BookingButtons } from '@/components/booking/BookingButtons';

export function TreatmentTemplate({ t }: { t: Treatment }) {
  const categoryHref = t.category === 'aesthetics' ? '/treatments' : '/dentistry';
  const categoryLabel = t.category === 'aesthetics' ? 'Aesthetics' : 'Dentistry';
  const related = t.related.map(getTreatment).filter(Boolean) as Treatment[];

  return (
    <article>
      {/* Hero */}
      <section className="relative overflow-hidden pt-[calc(var(--header-h,5.25rem)+1rem)]">
        <div className="container-lux grid gap-12 py-12 lg:grid-cols-2 lg:items-center lg:py-20">
          <div>
            <Reveal>
              <nav className="mb-6 flex items-center gap-2 text-sm text-[var(--color-stone)]" aria-label="Breadcrumb">
                <Link href="/" className="hover:text-[var(--color-ink)]">Home</Link>
                <span>/</span>
                <Link href={categoryHref} className="hover:text-[var(--color-ink)]">{categoryLabel}</Link>
                <span>/</span>
                <span className="text-[var(--color-ink)]">{t.title}</span>
              </nav>
            </Reveal>
            <Reveal delay={0.05}>
              <p className="eyebrow mb-4">{t.eyebrow}</p>
            </Reveal>
            <WordReveal as="h1" text={t.title} className="text-display" />
            <Reveal delay={0.15}>
              <p className="mt-4 font-[family-name:var(--font-display)] text-xl text-[var(--color-gold)] md:text-2xl">
                {t.tagline}
              </p>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--color-stone)]">{t.intro}</p>
            </Reveal>
            <Reveal delay={0.28}>
              <div className="mt-8">
                <BookingButtons />
              </div>
            </Reveal>
            <Reveal delay={0.34}>
              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-[var(--color-line)] pt-6">
                {t.facts.map((f) => (
                  <div key={f.label}>
                    <dt className="text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]">{f.label}</dt>
                    <dd className="mt-1 font-[family-name:var(--font-display)] text-lg">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>

          <Reveal delay={0.1}>
            <div className="relative">
              <GenerativeArt
                from={t.gradient[0]}
                to={t.gradient[1]}
                className="aspect-[4/5] w-full rounded-[var(--radius-2xl)] shadow-[var(--shadow-lift)]"
              />
              {t.priceFrom && (
                <div className="card-glass absolute -bottom-5 -left-5 rounded-[var(--radius-md)] px-6 py-4 shadow-[var(--shadow-soft)]">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]">
                    {t.priceFrom.startsWith('£') ? 'From' : 'Pricing'}
                  </p>
                  <p className="font-[family-name:var(--font-display)] text-2xl">{t.priceFrom}</p>
                </div>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-[var(--color-bone)] py-20 md:py-28">
        <div className="container-lux">
          <Reveal>
            <p className="eyebrow mb-4">The difference</p>
            <h2 className="text-title max-w-2xl">Why clients choose this treatment.</h2>
          </Reveal>
          <Stagger className="mt-12 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-2">
            {t.benefits.map((b) => (
              <StaggerItem key={b.title} className="bg-[var(--color-porcelain)] p-8">
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-full bg-[var(--color-ink)] text-[var(--color-gold-soft)]">
                  <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none">
                    <path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h3 className="font-[family-name:var(--font-display)] text-xl">{b.title}</h3>
                <p className="mt-2 leading-relaxed text-[var(--color-stone)]">{b.text}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Process */}
      <section className="container-lux py-20 md:py-28">
        <Reveal>
          <p className="eyebrow mb-4">The journey</p>
          <h2 className="text-title max-w-2xl">What to expect, step by step.</h2>
        </Reveal>
        <Stagger className="mt-12 grid gap-8 md:grid-cols-3">
          {t.process.map((s, i) => (
            <StaggerItem key={s.title} className="relative border-t border-[var(--color-ink)] pt-6">
              <p className="font-[family-name:var(--font-display)] text-5xl text-gold-gradient">
                {String(i + 1).padStart(2, '0')}
              </p>
              <h3 className="mt-4 font-[family-name:var(--font-display)] text-2xl">{s.title}</h3>
              <p className="mt-3 leading-relaxed text-[var(--color-stone)]">{s.text}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* FAQ */}
      <section className="bg-[var(--color-bone)] py-20 md:py-28">
        <div className="container-lux grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:items-start">
          <Reveal>
            <div className="lg:sticky lg:top-28">
              <p className="eyebrow mb-4">Good to know</p>
              <h2 className="text-title">Your questions, answered.</h2>
              <p className="mt-5 text-[var(--color-stone)]">
                Still curious? A complimentary consultation is the best way to get tailored answers.
              </p>
              <div className="mt-6">
                <Button href="/contact" variant="outline">
                  Ask our team <ArrowIcon />
                </Button>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <FaqAccordion faqs={t.faqs} />
          </Reveal>
        </div>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="container-lux py-20 md:py-28">
          <Reveal>
            <p className="eyebrow mb-4">You may also love</p>
            <h2 className="text-title">Complete the experience.</h2>
          </Reveal>
          <Stagger className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r, i) => (
              <StaggerItem key={r.slug}>
                <TreatmentCard t={r} index={i} />
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      )}
    </article>
  );
}
