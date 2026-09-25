import type { Faq } from '@/lib/treatments';

// K Academy FAQs — rendered on /academy (accordion + FAQPage JSON-LD) and
// repeated verbatim in /llms.txt so AI answer engines quote one consistent
// wording (BLD: GEO). Every answer must be true today. The funding answers
// follow the owner's position (September 2026): no direct government funding
// for learners (Advanced Learner Loans, Adult Skills Fund) before 2028.
export const academyFaqs: Faq[] = [
  {
    q: 'Where is K Academy?',
    a: 'K Academy is the training arm of KClinics at 4 Charterhouse Buildings, Goswell Road, Clerkenwell, Islington, London EC1M 7AN, a few minutes from Farringdon, Barbican and Old Street stations. Practical days take place inside the working clinic.',
  },
  {
    q: 'Are K Academy courses accredited?',
    a: 'Yes. Our Level 2 to Level 4 qualifications are Ofqual-regulated and awarded through VTCT, and our short courses are CPD-accredited. The awarding body, level and certificate for each course are shown on its course page.',
  },
  {
    q: 'How are courses delivered?',
    a: 'Blended learning. Theory is completed online through our Thinkific platform at your own pace, followed by hands-on practical days in the Islington clinic on the same equipment used in practice. Your VTCT exam is administered in-house.',
  },
  {
    q: 'Which levels do you teach?',
    a: 'From Level 2 foundation skin and laser, through Level 3 and Level 4 aesthetic practice, up to advanced Level 5 to 7 programmes. Entry requirements and prerequisites are listed on each course page.',
  },
  {
    q: 'Is government funding available for K Academy courses?',
    a: 'Not at the moment. Advanced Learner Loans and Mayor of London Adult Skills Fund places are not currently available through K Academy, and we do not expect direct learner funding to open before 2028. You can spread the cost with monthly course finance, or ask your employer to sponsor you.',
  },
  {
    q: 'Can I pay for a course monthly?',
    a: 'Yes. Monthly course finance is available through our finance partner, subject to status (18+, UK residents). You pay a deposit and spread the balance; your place is held while you pay.',
  },
  {
    q: 'When do courses start?',
    a: 'You can enrol at any time and we place you in the next suitable cohort. Upcoming cohort dates and remaining places are shown on each course page.',
  },
  {
    q: 'What happens after I qualify?',
    a: 'Eligible graduates can ask about leasing clinic-grade laser and aesthetic devices on flexible terms, so you can start treating clients without buying equipment outright. Ask the team through the trainee portal or by phone.',
  },
  {
    q: 'What are your centre policies?',
    a: 'Our learner policies (malpractice and maladministration, appeals, complaints, equality and inclusion, safeguarding, reasonable adjustments, assessment and internal quality assurance, health and safety, conduct and withdrawal, conflicts of interest) are published at kclinics.co.uk/academy/policies.',
  },
];
