import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal } from '@/components/motion/Reveal';
import { BookingButtons } from '@/components/booking/BookingButtons';
import { EnquiryForm } from '@/components/contact/EnquiryForm';
import { site } from '@/lib/site';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Contact & Find Us — Islington, London | K Clinics',
  description:
    'Visit K Clinics at 4 Charterhouse Buildings, Goswell Road, Islington, London. Book online, call, or email. Opening hours and directions.',
  path: '/contact',
  keywords: ['K Clinics contact', 'aesthetics clinic Islington address', 'book appointment London'],
});

export default function ContactPage() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Contact', path: '/contact' }])} />
      <PageHero
        eyebrow="Visit · Call · Book"
        title="Come and meet us."
        lede="A calm, private clinic in the heart of Clerkenwell. Book instantly online, or get in touch — we would love to welcome you."
        gradient={['#7b6a5d', '#2a2420']}
      >
        <BookingButtons />
      </PageHero>

      <section className="container-lux section grid gap-12 md:grid-cols-[0.9fr_1.1fr]">
        <Reveal>
          <div className="space-y-10">
            <div>
              <p className="eyebrow mb-3">Address</p>
              <p className="font-[family-name:var(--font-display)] text-2xl leading-snug">
                {site.address.street}
                <br />
                {site.address.locality}
                <br />
                {site.address.region} {site.address.postalCode}
              </p>
              <a href={site.mapLink} target="_blank" rel="noopener noreferrer" className="link-underline mt-3 inline-block text-sm font-medium text-[var(--color-gold)]">
                Get directions →
              </a>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="eyebrow mb-3">Call</p>
                <a href={site.phoneHref} className="link-underline text-lg">{site.phone}</a>
              </div>
              <div>
                <p className="eyebrow mb-3">Email</p>
                <a href={site.emailHref} className="link-underline text-lg">{site.email}</a>
              </div>
            </div>

            <div>
              <p className="eyebrow mb-3">Opening hours</p>
              <ul className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
                {site.hours.map((h) => (
                  <li key={h.day} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="text-[var(--color-ink-soft)]">{h.day}</span>
                    <span className={h.open === 'Closed' ? 'text-[var(--color-stone)]' : 'font-medium'}>
                      {h.open === 'Closed' ? 'Closed' : `${h.open} – ${h.close}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="eyebrow mb-4">Book instantly</p>
              <BookingButtons />
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="h-full min-h-[28rem] overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--color-line)] shadow-[var(--shadow-soft)]">
            <iframe
              title="K Clinics location map"
              src={site.mapEmbed}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-full min-h-[28rem] w-full grayscale-[0.2]"
            />
          </div>
        </Reveal>
      </section>

      {/* Enquiry form */}
      <section className="bg-[var(--color-bone)] section">
        <div className="container-lux grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:items-start">
          <Reveal>
            <div className="lg:sticky lg:top-28">
              <p className="eyebrow mb-4">Send an enquiry</p>
              <h2 className="text-title">Tell us what you’re looking for.</h2>
              <p className="mt-5 text-[var(--color-stone)]">
                Share a few details and our team will be in touch to arrange your complimentary consultation. Prefer to book instantly? Use the online booking above.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <EnquiryForm />
          </Reveal>
        </div>
      </section>
    </>
  );
}
