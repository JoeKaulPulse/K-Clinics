import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions, sessionCan } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { NewBookingButton } from '@/components/admin/NewBookingButton';
import { EmptyState } from '@/components/admin/EmptyState';
import { bookableTreatments } from '@/lib/treatments';
import { listServices } from '@/lib/services';
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

type SP = { filter?: string; q?: string; from?: string; to?: string };

export default async function BookingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const { filter = 'upcoming', q = '', from = '', to = '' } = await searchParams;
  const { listBookings } = await import('@/lib/crm-data');
  const session = await getSession();
  if (!sessionCan(session, 'bookings.view')) redirect('/admin');
  const rows = await listBookings({ filter, q, from, to });

  const can = await sessionPermissions();
  const locale = await getLocale();

  // Specific service variants/areas per treatment category (Underarms, Full Legs…)
  // so the phone-booking flow can pick the exact one — applying its own price +
  // duration (BLD-189). Service name prefixed only when a category has more than
  // one service, to keep area names clean (e.g. just "Underarms").
  const services = await listServices().catch(() => []);
  const serviceNamesBySlug = new Map<string, Set<string>>();
  for (const s of services) serviceNamesBySlug.set(s.treatmentSlug, (serviceNamesBySlug.get(s.treatmentSlug) ?? new Set()).add(s.name));
  const variantsBySlug = new Map<string, { id: string; name: string; durationMin: number; pricePence: number }[]>();
  for (const s of services) {
    const multi = (serviceNamesBySlug.get(s.treatmentSlug)?.size ?? 0) > 1;
    for (const v of s.variants) {
      const arr = variantsBySlug.get(s.treatmentSlug) ?? [];
      arr.push({ id: v.id, name: multi ? `${s.name} — ${v.name}` : v.name, durationMin: v.durationMin, pricePence: v.pricePence });
      variantsBySlug.set(s.treatmentSlug, arr);
    }
  }
  // "Consultation" — a bookable in-clinic consultation appointment for new clients
  // (BLD-203). First group so it's the obvious default for new-client phone calls.
  const treatmentsForBooking = [
    { slug: 'consultation', title: 'Consultation', group: 'Consultation', variants: [] as { id: string; name: string; durationMin: number; pricePence: number }[] },
    ...bookableTreatments.map((tr) => ({ slug: tr.slug, title: tr.title, group: tr.group, variants: variantsBySlug.get(tr.slug) ?? [] })),
  ];

  const tabHref = (k: string) => {
    const p = new URLSearchParams();
    p.set('filter', k);
    if (q) p.set('q', q);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    return `/admin/bookings?${p.toString()}`;
  };

  const rowCls = 'grid grid-cols-[1fr_auto] gap-3 border-b border-[var(--color-line)] px-5 py-4 last:border-0 sm:grid-cols-[1.3fr_1.4fr_1fr_auto] sm:items-center';

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">{t(locale, 'nav.bookings')}</h1>
        {sessionCan(session, 'bookings.manage') && (
          <NewBookingButton treatments={treatmentsForBooking} />
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link key={f.k} href={tabHref(f.k)}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${filter === f.k ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'border border-[var(--color-line)] hover:bg-[var(--color-bone)]'}`}>
            {f.label}
          </Link>
        ))}
      </div>

      {/* Search + date range */}
      <form className="mt-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="filter" value={filter} />
        <label className="text-xs text-[var(--color-stone)]">
          Search
          <span className="group relative mt-1 flex items-center">
            <span className="pointer-events-none absolute left-3 text-[var(--color-stone)] transition-colors group-focus-within:text-[var(--color-gold-deep)]">
              <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                <circle cx="9" cy="9" r="6.25" /><path d="m14 14 3.5 3.5" />
              </svg>
            </span>
            <input name="q" defaultValue={q} placeholder="Client or treatment…"
              className="block h-11 w-56 rounded-full border border-[var(--color-line)] bg-[var(--color-porcelain)] pl-9 pr-4 text-sm outline-none transition-shadow placeholder:text-[var(--color-stone-soft)] focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-gold)_22%,transparent)]" />
          </span>
        </label>
        <label className="text-xs text-[var(--color-stone)]">
          From
          <input type="date" name="from" defaultValue={from}
            className="mt-1 block h-11 rounded-full border border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 text-sm outline-none transition-shadow focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-gold)_22%,transparent)]" />
        </label>
        <label className="text-xs text-[var(--color-stone)]">
          To
          <input type="date" name="to" defaultValue={to}
            className="mt-1 block h-11 rounded-full border border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 text-sm outline-none transition-shadow focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-gold)_22%,transparent)]" />
        </label>
        <button className="h-11 rounded-full bg-[var(--color-ink)] px-4 text-sm font-medium text-[var(--color-porcelain)] transition-colors hover:bg-[var(--color-ink-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]">Apply</button>
        {(q || from || to) && (
          <Link href={`/admin/bookings?filter=${filter}`} className="px-2 py-2 text-sm text-[var(--color-stone)] underline">Clear</Link>
        )}
      </form>

      <div className="mt-5 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] tabular-nums">
        <p className="px-5 pt-3 text-sm text-[var(--color-stone)]">{rows.length}{rows.length === 300 ? '+' : ''} {rows.length === 1 ? 'booking' : 'bookings'}</p>
        {/* Header row */}
        <div className={`${rowCls} mt-2 bg-[var(--color-bone)] text-xs uppercase tracking-[0.12em] text-[var(--color-stone)]`}>
          <span>Client / treatment</span>
          <span className="hidden sm:block">Date</span>
          <span className="hidden sm:block">Price</span>
          <span className="justify-self-end">Status</span>
        </div>
        {rows.length === 0 && (
          <EmptyState
            title={q || from || to ? 'No bookings match' : 'No bookings in this view'}
            hint={q || from || to ? 'Try a wider date range or clear the search.' : 'Bookings appear here once appointments are made — or add one with “New phone booking”.'}
            icon={<><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" /></>}
          />
        )}
        {rows.map((b) => (
          <Link key={b.id} href={`/admin/bookings/${b.id}`} className={`${rowCls} hover:bg-[var(--color-bone)]`}>
            <div>
              <p className="font-medium">{b.client.firstName} {b.client.lastName ?? ''}</p>
              <p className="text-xs text-[var(--color-stone)]">{b.treatmentTitle}</p>
            </div>
            <p className="hidden text-sm text-[var(--color-stone)] sm:block">
              {new Date(b.startAt).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="hidden text-sm sm:block">{b.chargedAt ? `${money(b.chargedPence || 0)} paid` : b.pricePence > 0 ? money(b.pricePence) : '—'}</p>
            <span className="justify-self-end rounded-full bg-[var(--color-bone)] px-3 py-1 text-xs">{b.status}</span>
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}
