import { uid, type Section } from './sections';

// Faithful starting content for editorial routes, so "take over /x" opens the
// builder pre-filled to match the live page (then edit + publish). Used by the
// create API; never auto-published.

const s = (type: string, data: Record<string, unknown>): Section => ({ id: uid(), type, data });

export const PAGE_SEEDS: Record<string, () => Section[]> = {
  '/about': () => [
    s('hero', { eyebrow: 'Established 2026 · Islington, London', title: 'Redefining cosmetic dermatology and dentistry.', lede: 'Considered treatments, beautiful smiles and qualified clinicians. At KClinics, we believe aesthetic medicine should feel empowering, welcoming and simple to navigate — for every skin tone, gender and lifestyle.', ctaPrimaryLabel: 'Book now', ctaPrimaryHref: '/book' }),
    s('imageText', { eyebrow: 'Your natural beauty, our mission', heading: 'Care, customised entirely around you.', body: 'We believe beauty is more than your appearance in the mirror. Our mission is to emphasise your natural beauty using innovative technology and a professional approach — creating a personalised care plan for every client that delivers a feeling of harmony, confidence and beauty.\n\nThe goal of KClinics is to make high-quality, customised care accessible to everyone. Whether you’re looking for a subtle improvement or a life-changing outcome, our clinics are made to make you feel appreciated and cared for — the focus is always on you: your goals, your journey, your beauty.', side: 'left' }),
    s('featureGrid', { eyebrow: 'What we stand for', heading: 'Our values.', columns: '2', items: [
      { title: 'Innovation', text: 'We employ the most recent equipment in aesthetic medicine to provide results that are safe, efficient and long-lasting.' },
      { title: 'Professionalism', text: 'Our team holds recognised UK qualifications — including a Level 7–qualified injector and a prescriber — and works to the highest standards of care.' },
      { title: 'Personalised approach', text: 'Each procedure is customised to your particular needs and preferences, to achieve the best possible results.' },
      { title: 'Quiet luxury', text: 'Cutting-edge technology meets expert care in an inclusive, luxurious and welcoming environment built around you.' },
    ] }),
    s('cta', { heading: 'Begin your KClinics journey.', text: 'Every consultation is complimentary, and new clients enjoy 15% off their first visit.', ctaLabel: 'Book now', ctaHref: '/book', tone: 'ink' }),
  ],

  '/finance': () => [
    s('hero', { eyebrow: 'Cost & finance', title: 'Care that fits your budget.', lede: 'Exceptional treatment shouldn’t mean compromise. We keep pricing transparent and offer flexible ways to pay — including Buy Now, Pay Later — so you can move forward with confidence.', ctaPrimaryLabel: 'See the full price list', ctaPrimaryHref: '/pricing', ctaSecondaryLabel: 'Buy Now, Pay Later', ctaSecondaryHref: '#buy-now-pay-later' }),
    s('featureGrid', { heading: 'Flexible ways to pay.', columns: '2', items: [
      { title: 'Transparent pricing', text: 'Every treatment and course price is published up front — no hidden fees, ever. You’ll always know the full cost before you commit.' },
      { title: 'Pay as you go', text: 'Pay per session as you progress through a course, so you can spread the cost naturally over your treatment plan.' },
      { title: 'Consultation credited', text: 'Where a consultation fee applies (e.g. dental implants), it’s credited towards the cost of your treatment when you proceed.' },
      { title: '0% interest-free options', text: 'On eligible higher-value treatments we offer flexible, interest-free payment plans so you can focus on your care, not the cost.' },
    ] }),
    s('imageText', { eyebrow: 'Buy now, pay later', heading: 'Spread the cost, interest-free.', body: 'Split your treatment into smaller, manageable instalments at checkout with Clearpay or Klarna. Quick to set up, with no impact on the care you receive.\n\n• Choose Clearpay or Klarna when you pay.\n• Pay in interest-free instalments over a few weeks or months.\n• A soft check at sign-up — your treatment plan stays exactly the same.\n\nBuy Now, Pay Later is provided by Clearpay and Klarna, not by KClinics. Subject to status and eligibility; 18+, UK residents.', side: 'right' }),
    s('cta', { heading: 'Questions about paying?', text: 'Our team will happily talk you through the options and what suits you best.', ctaLabel: 'View pricing', ctaHref: '/pricing', tone: 'bone' }),
  ],

  '/membership': () => [
    s('hero', { eyebrow: 'Beauty Points · Membership', title: 'Rewarded for radiance.', lede: 'Our free rewards programme. Earn Beauty Points every time you visit — plus bonuses for reviews, birthdays and referrals — and turn them into money off your next treatment.', ctaPrimaryLabel: 'Book now', ctaPrimaryHref: '/book' }),
    s('stats', { items: [
      { value: '1 pt = £1', label: 'Earn a point per pound spent' },
      { value: '100 pts = £1', label: 'Redeemed as money off' },
      { value: 'Free to join', label: 'Automatic from your first visit' },
    ] }),
    s('featureGrid', { eyebrow: 'Ways to earn', heading: 'Four ways your points add up.', columns: '4', items: [
      { title: 'Every treatment', text: 'Earn a point for every pound you spend on treatments and packages — added automatically once your visit is complete.' },
      { title: 'Leave a review', text: 'Share your experience after a visit and we’ll thank you with points off your next treatment.' },
      { title: 'Your birthday', text: 'A little gift each year — points land on your birthday to spend on yourself.' },
      { title: 'Refer a friend', text: 'Give £25, get £25. When a friend you refer completes their first treatment, you both earn rewards.' },
    ] }),
    s('featureGrid', { eyebrow: 'How Beauty Points work', heading: 'Earn as you go, enjoy more each visit.', columns: '3', items: [
      { title: 'Earn as you go', text: 'Points collect automatically against your account — no card to carry, nothing to remember. Track your balance any time in your client portal.' },
      { title: 'Redeem your way', text: 'Every 100 points is worth £1. Apply them as money off at checkout, from a minimum of 100 points.' },
      { title: 'Keep them fresh', text: 'Points stay valid for months from the day you earn them, so there’s always a reason to treat yourself again soon.' },
    ] }),
    s('cta', { heading: 'Membership is complimentary — simply begin.', text: 'Create your account and your points start accruing from your very first treatment.', ctaLabel: 'Create your account', ctaHref: '/account/signup', tone: 'ink' }),
  ],

  '/contact': () => [
    s('hero', { eyebrow: 'Visit · Call · Book', title: 'Come and meet us.', lede: 'A calm, private clinic in the heart of Clerkenwell. Book instantly online, or get in touch — we would love to welcome you.', ctaPrimaryLabel: 'Book now', ctaPrimaryHref: '/book' }),
    s('contactInfo', { heading: '', showHours: true, showBooking: true }),
    s('map', { height: 'md' }),
    s('featureGrid', { eyebrow: 'Getting here', heading: 'A short walk from Farringdon & Barbican.', intro: 'Our clinic sits on Goswell Road in Clerkenwell, on the Islington–City borders. We welcome clients from across central and north London for aesthetics and aesthetic dentistry.', columns: '2', items: [
      { title: 'Nearest stations', text: 'Farringdon (Elizabeth line, Thameslink & Underground) · Barbican · Angel · Old Street — all within a 10-minute walk.' },
      { title: 'By car', text: 'Pay-and-display nearby; please check current TfL Congestion Charge boundaries.' },
    ] }),
    s('tags', { eyebrow: 'Areas we serve', items: ['Islington', 'Clerkenwell', 'Angel', 'Farringdon', 'Barbican', 'Old Street', 'Shoreditch', 'Hoxton', 'Finsbury', 'City of London', 'Holborn', 'King’s Cross', 'Bloomsbury', 'Highbury', 'Canonbury', 'Bethnal Green'].map((label) => ({ label })) }),
    s('enquiryForm', { eyebrow: 'Send an enquiry', heading: 'Tell us what you’re looking for.', intro: 'Share a few details and our team will be in touch to arrange your complimentary consultation.' }),
  ],

  '/clinics': () => [
    s('hero', { eyebrow: 'Our clinic', title: 'Find us in Clerkenwell.', lede: 'KClinics sits on the border of the City of London and Islington — a calm, private space minutes from Barbican, Farringdon and Old Street, easily reached on foot, by tube or by car.', ctaPrimaryLabel: 'Book now', ctaPrimaryHref: '/book' }),
    s('contactInfo', { heading: 'Where to find us', showHours: true, showBooking: false }),
    s('map', { height: 'lg' }),
    s('tags', { eyebrow: 'Nearest stations', items: ['Barbican', 'Farringdon', 'Old Street', "St Paul's", 'Angel'].map((label) => ({ label })) }),
    s('tags', { eyebrow: 'Parking nearby', items: ['Barbican Centre Car Park · EC2Y 8DS', 'NCP London Barbican · EC1A 4HY', 'Smithfield Car Park · EC1A 9DY'].map((label) => ({ label })) }),
    s('cta', { heading: 'Ready to visit?', text: 'Book online in under a minute, or call us to arrange your appointment.', ctaLabel: 'Book now', ctaHref: '/book', tone: 'ink' }),
  ],
};

export const pageSeed = (path: string): Section[] | null => (PAGE_SEEDS[path] ? PAGE_SEEDS[path]() : null);
