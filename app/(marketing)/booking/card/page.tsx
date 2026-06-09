import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal } from '@/components/motion/Reveal';
import { CardOnFileForm } from '@/components/booking/CardOnFileForm';
import { crmEnabled } from '@/lib/crm';
import { stripeEnabled } from '@/lib/stripe';
import { site } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Save a card | KClinics', robots: { index: false } };

const REUSABLE = ['requires_payment_method', 'requires_confirmation', 'requires_action'];

export default async function CardOnFilePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;

  let state: 'notfound' | 'saved' | 'closed' | 'ready' = 'notfound';
  let view: { treatment: string; startISO: string; clientSecret: string } | null = null;

  if (crmEnabled && stripeEnabled && t) {
    try {
    const { db, withDbRetry } = await import('@/lib/db');
    const { stripe, ensureCustomer } = await import('@/lib/stripe');
    const b = await withDbRetry(() => db.booking.findUnique({ where: { manageToken: t }, include: { client: true } }));
    if (b) {
      if (b.stripePaymentMethodId) state = 'saved';
      else if (['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(b.status)) state = 'closed';
      else {
        const customerId = b.stripeCustomerId || (await ensureCustomer(b.client));
        // Reuse an existing pending SetupIntent if there is one, else create one.
        let si = null;
        if (b.stripeSetupIntentId) {
          si = await stripe().setupIntents.retrieve(b.stripeSetupIntentId).catch(() => null);
          if (si && (!REUSABLE.includes(si.status) || si.customer !== customerId)) si = null;
        }
        if (!si) {
          si = await stripe().setupIntents.create({ customer: customerId, usage: 'off_session', payment_method_types: ['card'], metadata: { bookingId: b.id, clientId: b.clientId } });
          await db.booking.update({ where: { id: b.id }, data: { stripeSetupIntentId: si.id, stripeCustomerId: customerId } });
        }
        if (si.client_secret) {
          state = 'ready';
          view = { treatment: b.treatmentTitle, startISO: b.startAt.toISOString(), clientSecret: si.client_secret };
        }
      }
    }
    } catch (e) {
      // Degrade to the "link not found / call us" card rather than 500 on a blip.
      console.error('[booking/card] lookup failed:', (e as Error)?.message);
      state = 'notfound';
    }
  }

  return (
    <>
      <PageHero eyebrow="Your booking" title="Secure your appointment." gradient={['#7b6a5d', '#2a2420']} />
      <section className="container-narrow section">
        <Reveal>
          {state === 'ready' && view ? (
            <CardOnFileForm token={t!} treatment={view.treatment} startISO={view.startISO} clientSecret={view.clientSecret} />
          ) : (
            <div className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-10 text-center">
              <h2 className="text-title">
                {state === 'saved' ? 'Your card is already saved' : state === 'closed' ? 'This booking is closed' : 'Link not found'}
              </h2>
              <p className="mx-auto mt-3 max-w-md text-[var(--color-stone)]">
                {state === 'saved'
                  ? 'Thank you — your appointment is secured and no further action is needed.'
                  : (<>This link may have expired or already been used. Please call <a href={site.phoneHref} className="link-underline font-medium text-[var(--color-ink)]">{site.phone}</a> and we’ll help.</>)}
              </p>
            </div>
          )}
        </Reveal>
      </section>
    </>
  );
}
