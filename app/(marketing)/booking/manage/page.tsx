import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal } from '@/components/motion/Reveal';
import { ManageClient } from './ManageClient';
import { crmEnabled } from '@/lib/crm';
import { site } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Manage your booking | KClinics', robots: { index: false } };

export default async function ManageBookingPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;

  let booking: { treatmentTitle: string; treatmentSlug: string; startISO: string; status: string; pricePence: number; within24h: boolean; within48h: boolean; cancelled: boolean; rescheduleCount: number } | null = null;
  if (crmEnabled && t) {
    try {
      const { db, withDbRetry } = await import('@/lib/db');
      const b = await withDbRetry(() => db.booking.findUnique({ where: { manageToken: t } }));
      if (b) {
        booking = {
          treatmentTitle: b.treatmentTitle,
          treatmentSlug: b.treatmentSlug,
          startISO: b.startAt.toISOString(),
          status: b.status,
          pricePence: b.pricePence,
          within24h: b.startAt.getTime() - Date.now() < 24 * 60 * 60 * 1000,
          within48h: b.startAt.getTime() - Date.now() < 48 * 60 * 60 * 1000,
          cancelled: b.status === 'CANCELLED',
          rescheduleCount: b.rescheduleCount,
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
                This link may have expired or already been used. Please call <a href={site.phoneHref} className="link-underline font-medium text-[var(--color-ink)]">{site.phone}</a> and we’ll help.
              </p>
            </div>
          )}
        </Reveal>
      </section>
    </>
  );
}
