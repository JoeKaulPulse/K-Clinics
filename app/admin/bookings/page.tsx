import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions, sessionCan } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { NewBookingButton } from '@/components/admin/NewBookingButton';
import { bookableTreatments } from '@/lib/treatments';
import { getLocale } from '@/lib/locale';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

const FILTERS = [
  { k: 'upcoming', label: 'Upcoming' },
  { k: 'past', label: 'Past' },
  { k: 'CONFIRMED', label: 'Confirmed' },
  { k: 'COMPLETED', label: 'Completed' },
  { k: 'CANCELLED', label: 'Cancelled' },
  { k: 'ALL', label: 'All' },
];

const money = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}`;

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const { filter = 'upcoming' } = await searchParams;
  const { listBookings } = await import('@/lib/crm-data');
  const session = await getSession();
  if (!sessionCan(session, 'bookings.view')) redirect('/admin');
  const rows = await listBookings(filter);

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">{t(locale, 'nav.bookings')}</h1>
        {sessionCan(session, 'bookings.manage') && (
          <NewBookingButton treatments={bookableTreatments.map((t) => ({ slug: t.slug, title: t.title }))} />
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link key={f.k} href={`/admin/bookings?filter=${f.k}`}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${filter === f.k ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'border border-[var(--color-line)] hover:bg-[var(--color-bone)]'}`}>
            {f.label}
          </Link>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
        {rows.length === 0 && <p className="p-6 text-sm text-[var(--color-stone)]">No bookings in this view.</p>}
        {rows.map((b) => (
          <Link key={b.id} href={`/admin/bookings/${b.id}`}
            className="grid grid-cols-[1fr_auto] gap-3 border-b border-[var(--color-line)] px-5 py-4 last:border-0 hover:bg-[var(--color-bone)] sm:grid-cols-[1.3fr_1.4fr_1fr_auto] sm:items-center">
            <div>
              <p className="font-medium">{b.client.firstName} {b.client.lastName ?? ''}</p>
              <p className="text-xs text-[var(--color-stone)]">{b.treatmentTitle}</p>
            </div>
            <p className="hidden text-sm text-[var(--color-stone)] sm:block">
              {new Date(b.startAt).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="hidden text-sm sm:block">{b.chargedAt ? `${money(b.chargedPence || 0)} paid` : b.pricePence > 0 ? money(b.pricePence) : '—'}</p>
            <span className="justify-self-end rounded-full bg-[var(--color-bone)] px-3 py-1 text-xs">{b.status}</span>
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}
