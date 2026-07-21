import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal } from '@/components/motion/Reveal';
import { PayNowForm } from '@/components/booking/PayNowForm';
import { crmEnabled } from '@/lib/crm';
import { stripeEnabled } from '@/lib/stripe';
import { site } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Complete your payment | KClinics', robots: { index: false } };

// Recovery page for an off-session charge that needs the card-holder to
// authenticate (3-D Secure). Reached from the "Action needed to complete your
// payment" email, which links here with the PaymentIntent client secret.
// Statuses that still need the client to act:
const ACTIONABLE = ['requires_action', 'requires_confirmation'];

export default async function PayPage({ searchParams }: { searchParams: Promise<{ pi?: string }> }) {
  const { pi: piParam } = await searchParams;

  let state: 'notfound' | 'paid' | 'ready' | 'callus' = 'notfound';
  let view: { treatment: string; pricePence: number; clientSecret: string } | null = null;

  // BLD-716: `pi` is the PaymentIntent ID (new links carry the ID only, never the
  // client_secret). Legacy emails may still carry a full `pi_..._secret_...`
  // value; splitting on `_secret_` yields the ID for both. The client_secret used
  // to confirm the card is fetched server-side and only rendered into the form —
  // it never appears in the URL, server logs or browser history.
  if (crmEnabled && stripeEnabled && piParam && piParam.startsWith('pi_')) {
    try {
      const piId = piParam.split('_secret_')[0];
      const { stripe } = await import('@/lib/stripe');
      const { db, withDbRetry } = await import('@/lib/db');
      const pi = await stripe().paymentIntents.retrieve(piId).catch(() => null);
      // A real, unexpired PaymentIntent for a known booking is the capability;
      // the secret is read from Stripe, not the URL.
      if (pi && pi.client_secret && pi.metadata?.bookingId) {
        const b = await withDbRetry(() => db.booking.findUnique({ where: { id: pi.metadata.bookingId } }));
        if (b) {
          if (pi.status === 'succeeded' || b.chargedAt) state = 'paid';
          else if (ACTIONABLE.includes(pi.status)) { state = 'ready'; view = { treatment: b.treatmentTitle, pricePence: pi.amount, clientSecret: pi.client_secret }; }
          else state = 'callus'; // e.g. canceled / requires_payment_method — needs a new card
        }
      }
    } catch (e) {
      // A DB blip degrades to "link not found / call us", never a 500.
      console.error('[booking/pay] lookup failed:', (e as Error)?.message);
    }
  }

  return (
    <>
      <PageHero eyebrow="Your payment" title="Complete your payment." gradient={['#7b6a5d', '#2a2420']} />
      <section className="container-narrow section">
        <Reveal>
          {state === 'ready' && view ? (
            <PayNowForm treatment={view.treatment} pricePence={view.pricePence} clientSecret={view.clientSecret} />
          ) : (
            <div className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-10 text-center">
              <h2 className="text-title">
                {state === 'paid' ? 'You’re all paid' : state === 'callus' ? 'We need a quick hand to finish this' : 'Link not found'}
              </h2>
              <p className="mx-auto mt-3 max-w-md text-[var(--color-stone)]">
                {state === 'paid'
                  ? 'Thank you — this payment is already complete. No further action is needed.'
                  : (<>This link may have expired or already been used. Please call <a href={site.phoneHref} className="link-underline font-medium text-[var(--color-ink)]">{site.phone}</a> and we’ll take payment securely over the phone.</>)}
              </p>
            </div>
          )}
        </Reveal>
      </section>
    </>
  );
}
