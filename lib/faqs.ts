import type { Faq } from '@/lib/treatments';

export const generalFaqs: { heading: string; items: Faq[] }[] = [
  {
    heading: 'Visiting K Clinics',
    items: [
      { q: 'Where are you located?', a: 'We are in the heart of Clerkenwell, Islington — at 4 Charterhouse Buildings, Goswell Road, moments from Farringdon and Barbican stations.' },
      { q: 'Do you offer free consultations?', a: 'Yes. Every consultation is complimentary, and there is never any obligation to proceed. It is simply the best way to design the right plan for you.' },
      { q: 'Is there a discount for new clients?', a: 'New clients enjoy 15% off their first visit, for either aesthetic or dental treatment. Mention it when you book.' },
    ],
  },
  {
    heading: 'Booking & payment',
    items: [
      { q: 'How do I book an appointment?', a: 'Book instantly online via Treatwell or Fresha, call us, or send an enquiry — whichever suits you best. We will confirm your appointment promptly.' },
      { q: 'Can I pay in instalments?', a: 'For larger treatment plans and packages, flexible payment options are available. We will talk you through them at your consultation.' },
      { q: 'What is your cancellation policy?', a: 'We kindly ask for at least 24–48 hours’ notice to reschedule, so we can offer the time to another client. Full details are shared at booking.' },
    ],
  },
  {
    heading: 'Treatments & safety',
    items: [
      { q: 'Are your treatments safe?', a: 'Absolutely. We use medical-grade technology, follow rigorous protocols and our treatments are delivered by trained, experienced clinicians who put your safety first.' },
      { q: 'Will my results look natural?', a: 'Natural-looking enhancement is our signature. We treat conservatively and artistically, so you look like a refreshed, confident version of yourself.' },
      { q: 'How do I know which treatment is right for me?', a: 'That is exactly what your consultation is for. We assess your goals and recommend a clear, honest, personalised plan — no pressure, ever.' },
    ],
  },
];

export const allGeneralFaqs: Faq[] = generalFaqs.flatMap((g) => g.items);
