// Booking runs in one of two modes:
//  • 'live'  — real Stripe + database backend (Vercel). Cards are really saved
//              and charged per the policy.
//  • 'demo'  — no backend (e.g. the static GitHub Pages preview). The full UI
//              works end-to-end client-side with realistic availability and a
//              branded card step that accepts Stripe TEST cards. Nothing is
//              actually charged; bookings live in the browser only.
//
// Mode is decided by whether a real (non-placeholder) Stripe publishable key is
// present at build time.
const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

export const bookingMode: 'live' | 'demo' =
  pk && !pk.includes('placeholder') && pk.startsWith('pk_') ? 'live' : 'demo';

export const isDemo = bookingMode === 'demo';
