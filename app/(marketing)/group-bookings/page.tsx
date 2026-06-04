import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal } from '@/components/motion/Reveal';
import { GroupBookingForm } from '@/components/booking/GroupBookingForm';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMeta({
  title: 'Group & Party Bookings — Birthdays, Hen Parties | KClinics London',
  description: 'Book the clinic for your celebration — birthdays, hen and bridal parties, corporate days. A private, luxe aesthetics experience for your group in Islington, London.',
  path: '/group-bookings',
  keywords: ['group booking aesthetics London', 'birthday party clinic', 'hen party facials London', 'bridal party skincare', 'corporate beauty day'],
});

const PERKS = [
  { t: 'A private, luxe experience', d: 'The clinic to yourselves — calm, considered and beautifully hosted from arrival.' },
  { t: 'Tailored to the occasion', d: 'Glow-ready facials, skin treatments and more, curated to your group and your date.' },
  { t: 'Refreshments & a glow', d: 'Add the finishing touches — refreshments and a memorable moment for everyone.' },
];

export default function GroupBookingsPage() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Group bookings', path: '/group-bookings' }])} />
      <PageHero
        eyebrow="Celebrate together"
        title="Group & party bookings."
        lede="Birthdays, hen and bridal parties, corporate days — gather your favourite people for a private, glow-getting experience at KClinics."
        gradient={['#c2a589', '#3d352f']}
      />

      <section className="border-b border-[var(--color-line)] bg-[var(--color-bone)]">
        <div className="container-lux grid gap-6 py-12 sm:grid-cols-3">
          {PERKS.map((p) => (
            <Reveal key={p.t}>
              <div>
                <h3 className="font-[family-name:var(--font-display)] text-xl">{p.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-stone)]">{p.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="container-narrow section">
        <Reveal>
          <h2 className="font-[family-name:var(--font-display)] text-3xl">Tell us about your event</h2>
          <p className="mt-2 max-w-2xl text-[var(--color-stone)]">Share a few details and our team will craft the perfect day — from treatments to timings.</p>
          <div className="mt-8"><GroupBookingForm /></div>
        </Reveal>
      </section>
    </>
  );
}
