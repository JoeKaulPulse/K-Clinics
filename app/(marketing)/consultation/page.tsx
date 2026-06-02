import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal } from '@/components/motion/Reveal';
import { ConsultForm } from '@/components/consult/ConsultForm';
import { site } from '@/lib/site';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMeta({
  title: 'Book a Free Consultation — Islington, London | KClinics',
  description:
    'Request your complimentary consultation at KClinics, Islington. Tell us your goals and our expert team will design a bespoke treatment plan. New clients enjoy 15% off.',
  path: '/consultation',
  keywords: ['free consultation London', 'aesthetics consultation Islington', 'book consultation clinic'],
});

const points = [
  'A relaxed, unhurried conversation about your goals',
  'Expert assessment from experienced clinicians',
  'A clear, personalised plan with transparent pricing',
  '15% off your first treatment as a new client',
];

export default function ConsultationPage() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Consultation', path: '/consultation' }])} />
      <PageHero
        eyebrow="Complimentary consultation"
        title="Begin with a conversation."
        lede="Every transformation starts here. Share a few details and our team will craft a consultation around you — with no obligation, ever."
        gradient={['#7b6a5d', '#2a2420']}
      />

      <section className="container-lux section grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <Reveal>
          <div className="lg:sticky lg:top-28">
            <p className="eyebrow mb-4">What to expect</p>
            <h2 className="text-title">Considered care, from the very first hello.</h2>
            <ul className="mt-8 space-y-4">
              {points.map((p) => (
                <li key={p} className="flex items-start gap-3 text-[var(--color-ink-soft)]">
                  <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--color-ink)] text-[var(--color-gold-soft)]">
                    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none"><path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                  {p}
                </li>
              ))}
            </ul>
            <p className="mt-8 text-sm text-[var(--color-stone)]">
              Prefer to talk? Call <a href={site.phoneHref} className="link-underline font-medium text-[var(--color-ink)]">{site.phone}</a>
            </p>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <ConsultForm />
        </Reveal>
      </section>

      {/* Dental consultations anchor */}
      <section id="dental" className="container-lux section scroll-mt-28">
        <Reveal>
          <div className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 md:p-12">
            {site.dentistryLive ? (
              <>
                <p className="eyebrow mb-3">Cosmetology & dental consultations</p>
                <h2 className="text-title">Whether it’s your skin or your smile.</h2>
                <p className="mt-4 max-w-2xl text-[var(--color-ink-soft)]">
                  The form above covers both sides of KClinics — simply tell us whether you’re interested in aesthetics, aesthetic dentistry, or both, and we’ll match you with the right clinician. Dental consultations include an assessment of your goals and a clear, costed plan; where a consultation fee applies, it’s credited towards your treatment.
                </p>
                <p className="mt-4 text-sm text-[var(--color-stone)]">
                  Explore <a href="/treatments" className="link-underline font-medium text-[var(--color-ink)]">cosmetology treatments</a> or <a href="/dentistry" className="link-underline font-medium text-[var(--color-ink)]">dental treatments</a> first if you’d like.
                </p>
              </>
            ) : (
              <>
                <p className="eyebrow mb-3">Dentistry · Opening soon</p>
                <h2 className="text-title">Dental consultations are on their way.</h2>
                <p className="mt-4 max-w-2xl text-[var(--color-ink-soft)]">
                  The consultation above is for our aesthetics treatments. Our dentistry suite is opening soon — <a href="/dentistry#interest" className="link-underline font-medium text-[var(--color-ink)]">register your interest</a> and we’ll let you know the moment dental consultations are available to book.
                </p>
              </>
            )}
          </div>
        </Reveal>
      </section>
    </>
  );
}
