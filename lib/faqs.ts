import type { Faq } from '@/lib/treatments';

export const generalFaqs: { heading: string; items: Faq[] }[] = [
  {
    heading: 'Visiting KClinics',
    items: [
      { q: 'Where are you located?', a: 'We are in the heart of Clerkenwell, Islington — at 4 Charterhouse Buildings, Goswell Road, moments from Farringdon and Barbican stations.' },
      { q: 'Do you offer free consultations?', a: 'Yes. Every consultation is complimentary, and there is never any obligation to proceed. It is simply the best way to design the right plan for you.' },
      { q: 'Is there a discount for new clients?', a: 'New clients enjoy 15% off their first visit, for either aesthetic or dental treatment. Mention it when you book.' },
    ],
  },
  {
    heading: 'Booking & payment',
    items: [
      { q: 'How do I book an appointment?', a: 'Book online in under a minute — choose your treatment and time and your card is saved securely (no payment is taken until your treatment is delivered). You can also call us or request a consultation.' },
      // BLD-1827: names Klarna/Clearpay only where they are genuinely offered.
      // Self-service BNPL is live on Academy enrolment, the shop and gift cards
      // (PaymentIntent with automatic_payment_methods + Stripe PaymentElement).
      // For treatments it is a staff-sent payment link (hosted Checkout), not
      // the online booking form -- booking takes no payment at all, so the copy
      // deliberately does not promise BNPL "at checkout" when you book.
      { q: 'Can I pay in instalments?', a: 'Often, yes. Klarna and Clearpay let you spread the cost on KClinics Academy courses, gift cards and anything in our online shop — you pick them at checkout. For treatment courses and packages, ask the team and we will send you a secure payment link with those options on it. Approval, payment schedules and eligibility are decided by Klarna or Clearpay, not by us, so we cannot guarantee you will be accepted. Booking an appointment online never takes a payment — it only saves your card.' },
      { q: 'Do you accept Klarna or Clearpay?', a: 'Yes, on eligible purchases. You can choose Klarna or Clearpay directly at checkout for KClinics Academy courses, gift cards and online shop orders. For treatments, packages and courses of treatment, our team can send you a secure payment link that includes them. They are independent providers, not KClinics: eligibility checks, approval and the payment schedule are entirely their decision, so please read their terms before you commit.' },
      { q: 'What is your cancellation policy?', a: 'Cancellations are completely free up to 24 hours before your appointment. Within 24 hours, the full treatment fee applies (charged to the card saved at booking). You can cancel any time from the link in your confirmation email.' },
      { q: 'When am I charged?', a: 'Never upfront. Your card is securely saved when you book, but you are only charged once your treatment has been delivered — or, for late cancellations, per our 24-hour policy.' },
    ],
  },
  {
    heading: 'Treatments & safety',
    items: [
      { q: 'Are your treatments safe?', a: 'Absolutely. We use professional technology, follow rigorous protocols and our treatments are delivered by trained, experienced clinicians who put your safety first.' },
      { q: 'Will my results look natural?', a: 'Natural-looking enhancement is our signature. We treat conservatively and artistically, so you look like a refreshed, confident version of yourself.' },
      { q: 'How do I know which treatment is right for me?', a: 'That is exactly what your consultation is for. We assess your goals and recommend a clear, honest, personalised plan — no pressure, ever.' },
    ],
  },
];

export const allGeneralFaqs: Faq[] = generalFaqs.flatMap((g) => g.items);
