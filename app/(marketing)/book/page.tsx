import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal } from '@/components/motion/Reveal';
import { BookingFlow } from '@/components/booking/BookingFlow';
import { treatments, bookingFor } from '@/lib/treatments';
import { site } from '@/lib/site';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Book an Appointment — Islington, London | K Clinics',
  description:
    'Book your appointment at K Clinics, Islington in seconds. Choose your treatment and time; your card is saved securely and only charged when your service is delivered. Free cancellation up to 24 hours before.',
  path: '/book',
  keywords: ['book appointment London', 'aesthetics booking Islington', 'clinic online booking'],
});

const list = treatments.map((t) => ({
  slug: t.slug, title: t.title, group: t.group, category: t.category,
  tagline: t.tagline, ...bookingFor(t.slug),
}));

export default function BookPage() {
  const points = [
    'Your card is saved securely — no payment is taken now',
    'You’re only charged when your treatment is delivered',
    'Free cancellation up to 24 hours before your appointment',
    'New clients enjoy 15% off their first visit',
  ];

  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Book', path: '/book' }])} />
      <PageHero
        eyebrow="Booking"
        title="Reserve your appointment."
        lede="Choose your treatment and a time that suits you. It takes less than a minute — and you won’t pay a penny until your treatment is delivered."
        gradient={['#7b6a5d', '#2a2420']}
      />

      <section className="container-lux section grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <Reveal>
          <div className="lg:sticky lg:top-28">
            <p className="eyebrow mb-4">How it works</p>
            <h2 className="text-title">Effortless, and entirely on your terms.</h2>
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
          <BookingFlow treatments={list} />
        </Reveal>
      </section>
    </>
  );
}
