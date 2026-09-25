import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal } from '@/components/motion/Reveal';
import { ManageClient } from './ManageClient';
import { crmEnabled } from '@/lib/crm';
import { PhoneLink } from '@/components/marketing/PhoneLink';
import { isWithinSelfServiceWindow } from '@/lib/cancellation-policy';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Manage your booking | KClinics', robots: { index: false } };

export default async function ManageBookingPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;

  // priceOverridden (BLD-1869): staff priced this appointment themselves, so
  // pricePence 0 is the agreed price and not "assessed at your visit".
  let booking: { treatmentTitle: string; treatmentSlug: string; startISO: string; status: string; pricePence: number; priceOverridden: boolean; within24h: boolean; within48h: boolean; cancelled: boolean; rescheduleCount: number; clientFirstName: string; clientEmail: string } | null = null;
  if (crmEnabled && t) {
    try {
      const { db, withDbRetry } = await import('@/lib/db');
      // BLD-1421: also pull the client's name/email so a no-slots reschedule can
      // offer the same WaitlistCTA as fresh booking, prefilled like BookingFlow.
      const b = await withDbRetry(() => db.booking.findUnique({ where: { manageToken: t }, include: { client: { select: { firstName: true, email: true } } } }));
      if (b) {
        booking = {
          treatmentTitle: b.treatmentTitle,
          treatmentSlug: b.treatmentSlug,
          startISO: b.startAt.toISOString(),
          status: b.status,
          pricePence: b.pricePence,
          priceOverridden: !!b.priceOverriddenAt,
          within24h: b.startAt.getTime() - Date.now() < 24 * 60 * 60 * 1000,
          // BLD-1920: within48h now gates BOTH self-service reschedule and
          // cancel below (the same window lib/booking-actions.ts enforces
          // server-side) — read from the one shared helper.
          within48h: isWithinSelfServiceWindow(b.startAt),
          cancelled: b.status === 'CANCELLED',
          rescheduleCount: b.rescheduleCount,
          clientFirstName: b.client.firstName,
          clientEmail: b.client.email,
        };
      }
    } catch (e) {
      // A DB blip shouldn't 500 the page — fall through to the "not found / call
      // us" card, which is a safe, helpful degraded state.
      console.error('[manage-booking] lookup failed:', (e as Error)?.message);
    }
  }

  return (
    <>
      <PageHero eyebrow="Your booking" title="Manage your appointment." gradient={['#7b6a5d', '#2a2420']} />
      <section className="container-narrow section">
        <Reveal>
          {booking ? (
            <ManageClient token={t!} booking={booking} />
          ) : (
            <div className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-10 text-center">
              <h2 className="text-title">Booking not found</h2>
              <p className="mx-auto mt-3 max-w-md text-[var(--color-stone)]">
                This link may have expired or already been used. Please call <PhoneLink className="link-underline font-medium text-[var(--color-ink)]" /> and we’ll help.
              </p>
            </div>
          )}
        </Reveal>
      </section>
    </>
  );
}
