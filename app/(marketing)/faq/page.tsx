import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { FaqAccordion } from '@/components/ui/FaqAccordion';
import { Reveal } from '@/components/motion/Reveal';
import { BookingButtons } from '@/components/booking/BookingButtons';
import { generalFaqs, allGeneralFaqs } from '@/lib/faqs';
import { pageMeta, JsonLd, breadcrumbLd, faqLd } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMeta({
  title: 'Frequently Asked Questions | K Clinics London',
  description:
    'Answers to common questions about treatments, booking, pricing and safety at K Clinics, Islington, London. Complimentary consultations and 15% off your first visit.',
  path: '/faq',
});

export default function FaqPage() {
  return (
    <>
      <JsonLd
        data={[faqLd(allGeneralFaqs), breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'FAQ', path: '/faq' }])]}
      />
      <PageHero
        eyebrow="Everything explained"
        title="Your questions, thoughtfully answered."
        lede="Everything you might want to know before your first visit. If your question isn’t here, our team would be delighted to help."
        gradient={['#2a2420', '#7b6a5d']}
      >
        <BookingButtons />
      </PageHero>

      <section className="container-lux section">
        <div className="space-y-16">
          {generalFaqs.map((g) => (
            <Reveal key={g.heading}>
              <div className="grid gap-8 lg:grid-cols-[0.5fr_1.5fr] lg:items-start">
                <h2 className="text-title lg:sticky lg:top-28">{g.heading}</h2>
                <FaqAccordion faqs={g.items} />
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
