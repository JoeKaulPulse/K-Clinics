// THROWAWAY capture route for the launch Story (not linked anywhere, gitignored
// from the product via .storyignore note). Renders the REAL <BookingFlow> with a
// hardcoded catalogue so the genuine booking UI can be filmed without a database
// or Stripe. Runs in demo mode (no NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).
import { BookingFlow } from '@/components/booking/BookingFlow';

export const dynamic = 'force-static';

const catalogue = [
  {
    id: 'svc-hydraglow', slug: 'hydraglow-facial', treatmentSlug: 'hydraglow-facial',
    name: 'HydraGlow Facial', category: 'skin', audience: 'all',
    variants: [
      { id: 'v-hg-express', name: 'Express · 30 min', durationMin: 30, pricePence: 8500, offerPence: 7225, offerName: 'Welcome 15%', courses: [] },
      { id: 'v-hg-signature', name: 'Signature · 45 min', durationMin: 45, pricePence: 12000, offerPence: null, offerName: null, courses: [] },
      { id: 'v-hg-deluxe', name: 'Deluxe · 60 min', durationMin: 60, pricePence: 16000, offerPence: null, offerName: null, courses: [] },
    ],
  },
  {
    id: 'svc-hifu', slug: 'smas-hifu-lifting', treatmentSlug: 'smas-hifu-lifting',
    name: 'SMAS HIFU Lifting', category: 'skin', audience: 'all',
    variants: [
      { id: 'v-hifu-lower', name: 'Lower face & jawline', durationMin: 60, pricePence: 45000, offerPence: null, offerName: null, courses: [] },
      { id: 'v-hifu-full', name: 'Full face', durationMin: 90, pricePence: 65000, offerPence: null, offerName: null, courses: [] },
      { id: 'v-hifu-faceneck', name: 'Face & neck', durationMin: 120, pricePence: 85000, offerPence: null, offerName: null, courses: [] },
    ],
  },
  {
    id: 'svc-laser', slug: 'laser-hair-removal', treatmentSlug: 'laser-hair-removal',
    name: 'Laser Hair Removal', category: 'laser', audience: 'all',
    variants: [
      { id: 'v-laser-underarm', name: 'Underarms', durationMin: 15, pricePence: 6000, offerPence: null, offerName: null,
        courses: [{ sessions: 6, totalPence: 30000 }, { sessions: 8, totalPence: 38000 }] },
      { id: 'v-laser-legs', name: 'Full legs', durationMin: 45, pricePence: 18000, offerPence: null, offerName: null,
        courses: [{ sessions: 6, totalPence: 90000 }] },
    ],
  },
  {
    id: 'svc-injectables', slug: 'cosmetic-injections', treatmentSlug: 'cosmetic-injections',
    name: 'Cosmetic Injections', category: 'injectables', audience: 'all',
    variants: [
      { id: 'v-inj-1', name: 'One area', durationMin: 30, pricePence: 18000, offerPence: null, offerName: null, courses: [] },
      { id: 'v-inj-2', name: 'Two areas', durationMin: 30, pricePence: 25000, offerPence: null, offerName: null, courses: [] },
      { id: 'v-inj-3', name: 'Three areas', durationMin: 45, pricePence: 32000, offerPence: null, offerName: null, courses: [] },
    ],
  },
];

const client = { signedIn: true, firstName: 'Sofia', email: 'sofia@example.com', gender: null, smsReminders: false, hasPhone: true, welcomeEligible: true };

export default function StoryBookingDemo() {
  return (
    <main className="min-h-screen bg-[var(--color-porcelain)] px-5 py-8">
      <div className="mx-auto max-w-[440px]">
        <BookingFlow catalogue={catalogue} client={client} />
      </div>
    </main>
  );
}
