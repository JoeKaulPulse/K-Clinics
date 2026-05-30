import Link from 'next/link';
import { notFound } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { BookingActions } from '@/components/admin/BookingActions';

export const dynamic = 'force-dynamic';

const money = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}`;

export default async function BookingDetail({ params }: { params: Promise<{ id: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const { id } = await params;
  const { getBooking } = await import('@/lib/crm-data');
  const session = await getSession();
  const b = await getBooking(id);
  if (!b) notFound();

  const within24h = b.startAt.getTime() - Date.now() < 24 * 60 * 60 * 1000;
  const name = [b.client.firstName, b.client.lastName].filter(Boolean).join(' ');

  return (
    <AdminShell user={session?.email}>
      <Link href="/admin/bookings" className="text-sm text-[var(--color-gold)] hover:underline">← Bookings</Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="inline-block rounded-full bg-[var(--color-bone)] px-3 py-1 text-xs uppercase tracking-[0.16em]">{b.status}</span>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl">{b.treatmentTitle}</h1>
          <p className="mt-1 text-[var(--color-stone)]">
            {new Date(b.startAt).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
            {' · '}{b.durationMin} min
          </p>
        </div>
        <div className="text-right">
          <p className="font-[family-name:var(--font-display)] text-2xl">{b.pricePence > 0 ? money(b.pricePence) : 'On consultation'}</p>
          {b.chargedAt && <p className="text-xs text-[var(--color-jade)]">Charged {money(b.chargedPence || 0)}</p>}
          {b.lateCancel && <p className="text-xs text-[var(--color-stone)]">Cancelled within 24h{b.feeWaived ? ' · fee waived' : ''}</p>}
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <section>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">Client</h2>
          <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
            <Link href={`/admin/clients/${b.clientId}`} className="font-medium hover:text-[var(--color-gold)]">{name}</Link>
            <p className="mt-1 text-sm text-[var(--color-stone)]">{b.client.email}{b.client.phone ? ` · ${b.client.phone}` : ''}</p>
            {b.notes && <p className="mt-3 border-t border-[var(--color-line)] pt-3 text-sm">{b.notes}</p>}
            <p className="mt-3 text-xs text-[var(--color-stone-soft)]">
              Card {b.stripePaymentMethodId ? 'saved ✓' : 'not saved'} · booked {new Date(b.createdAt).toLocaleDateString('en-GB')}
            </p>
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">Actions</h2>
          <BookingActions
            bookingId={b.id}
            status={b.status}
            pricePence={b.pricePence}
            within24h={within24h}
            charged={b.chargedAt ? (b.chargedPence ?? 0) : null}
          />
        </section>
      </div>
    </AdminShell>
  );
}
