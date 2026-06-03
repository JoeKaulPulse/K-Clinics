import type { TourStep } from '@/components/guide/Tour';

// Guided tours per area. Targets reference [data-tour="…"] anchors on the page.
export const TOURS: Record<string, { label: string; steps: TourStep[] }> = {
  admin: {
    label: 'Admin tour',
    steps: [
      { title: 'Welcome to your dashboard', body: 'This quick tour shows where everything lives. Use the Help button (?) any time to run it again.' },
      { target: 'admin-nav', title: 'The main menu', body: 'Everything is grouped here — Today, Clients, Catalogue, Operations, Marketing, Finance and Admin. Click a group to expand it.' },
      { target: 'nav.bookings', title: 'Bookings', body: 'Every appointment, the calendar and the booking engine. Open a booking to run the clinical workflow, take consent and charge.' },
      { target: 'nav.clients', title: 'Clients', body: 'The single client record — contact, history, consent and encrypted clinical notes.' },
      { target: 'nav.services', title: 'Services & products', body: 'Set your bookable menu and prices, and (just below) manage retail products and stock.' },
      { target: 'nav.marketing', title: 'Marketing hub', body: 'Campaigns, brand kit, email, audiences, A/B testing, insights, ads and your performance & forecast — all in one place.' },
      { target: 'nav.golive', title: 'Go live', body: 'A plain-English launch checklist that shows exactly what’s ready and what still needs you.' },
      { target: 'admin-search', title: 'Search everything', body: 'Jump straight to any client, booking or page from here.' },
      { title: 'That’s the tour', body: 'Open any section to dive in. The Help (?) button is always in the corner if you need this again.' },
    ],
  },
  clinician: {
    label: 'Appointment tour',
    steps: [
      { title: 'Running an appointment', body: 'This is the booking screen. Here’s the safe order of things before, during and after treatment.' },
      { target: 'clinical-consent', title: '1 · Consent', body: 'Create a signing link the client e-signs on their phone or the iPad. With the consent gate on, you can’t start until it’s signed.' },
      { target: 'clinical-photo', title: '2 · Before photo (laser)', body: 'For laser, capture a before photo here — it stays securely in the system, never on your device. Or take a signed opt-out.' },
      { target: 'clinical-workflow', title: '3 · Pre-checks & start', body: 'Review the SOP and any medical flag, then press Start. The pre-checks must be cleared first.' },
      { target: 'clinical-note', title: '4 · Clinical note', body: 'Record your encrypted treatment note. Only staff with clinical access can read it.' },
      { target: 'clinical-actions', title: '5 · Finish & charge', body: 'Mark the appointment completed, then take payment from the card on file. You can’t charge before completion.' },
    ],
  },
  client: {
    label: 'Portal tour',
    steps: [
      { title: 'Welcome to your account', body: 'Here’s a quick look around your client portal.' },
      { target: 'nav.appointments', title: 'Appointments', body: 'See, manage and rebook your appointments.' },
      { target: 'nav.rewards', title: 'Rewards & referrals', body: 'Track your points and share your referral link to earn rewards.' },
      { target: 'nav.giftcards', title: 'Gift cards', body: 'Add a gift card to your account to use against your treatments.' },
      { target: 'nav.assessments', title: 'Health forms', body: 'Complete your medical history and pre-treatment forms securely before your visit.' },
      { title: 'You’re all set', body: 'The Help (?) button is always here if you want this tour again.' },
    ],
  },
  academy: {
    label: 'Academy tour',
    steps: [
      { title: 'Welcome to K Academy', body: 'Here’s how your training works from start to finish.' },
      { target: 'academy-courses', title: 'Your courses', body: 'Your enrolled courses and progress appear here.' },
      { title: 'Theory & quizzes', body: 'Work through the online theory and pass the quizzes at your own pace.' },
      { title: 'Practical & certificates', body: 'Attend your scheduled practical dates, then download your certificate when you complete a course.' },
    ],
  },
};

/** Choose the tour for the current path (or null if none applies). */
export function tourForPath(pathname: string): string | null {
  if (/^\/admin\/bookings\/[^/]+$/.test(pathname)) return 'clinician';
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/account')) return 'client';
  if (pathname.startsWith('/academy')) return 'academy';
  return null;
}
