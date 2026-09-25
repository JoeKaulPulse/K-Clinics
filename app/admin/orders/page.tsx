import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { PageSearch } from '@/components/admin/PageSearch';
import { OrdersManager, type OrderRow } from '@/components/admin/OrdersManager';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

// BLD-1211: status tabs over the retail order lifecycle. '' (All) preserves
// the page's original default of hiding PENDING (abandoned/unpaid checkouts);
// Pending is its own explicit tab for staff who do need to find one.
const STATUS_TABS = [
  { k: '', label: 'All' },
  { k: 'PENDING', label: 'Pending' },
  { k: 'PAID', label: 'Paid' },
  { k: 'FULFILLED', label: 'Fulfilled' },
  { k: 'REFUNDED', label: 'Refunded' },
  { k: 'CANCELLED', label: 'Cancelled' },
];

type SP = { q?: string; status?: string; page?: string };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'finance.view')) redirect('/admin');

  const { q = '', status = '', page: pageParam } = await searchParams;
  const reqPage = Math.max(1, Number(pageParam) || 1);
  const { listOrders } = await import('@/lib/crm-data');
  const { rows: orders, total, page, pages } = await listOrders({ q, status, page: reqPage });
  const rows: OrderRow[] = orders.map((o) => ({
    id: o.id, number: o.number, createdAt: o.createdAt.toISOString(), name: o.name, email: o.email,
    method: o.method, totalPence: o.totalPence, status: o.status, fulfillment: o.fulfillment, trackingNote: o.trackingNote ?? '',
    address: o.method === 'ship' ? [o.shipLine1, o.shipLine2, o.shipCity, o.shipPostcode].filter(Boolean).join(', ') : 'Collect in clinic',
    items: o.items.map((i) => ({ name: i.name, qty: i.qty, ageRestricted: i.ageRestricted })),
  }));

  const can = await sessionPermissions();
  const locale = await getLocale();

  // Build a querystring preserving current params, overriding some — same
  // shape as /admin/clients (lib/crm-data.ts's listClients). Changing the
  // search or status tab drops `page`; only Prev/Next carry a page through.
  const qs = (over: Partial<SP>) => {
    const p = new URLSearchParams();
    const merged = { q, status, ...over };
    if (merged.q) p.set('q', merged.q);
    if (merged.status) p.set('status', merged.status);
    if (merged.page && Number(merged.page) > 1) p.set('page', String(merged.page));
    const s = p.toString();
    return s ? `?${s}` : '';
  };

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">Orders</h1>
          <p className="mt-1 text-sm text-[var(--color-stone)]">Retail product orders — fulfil, add tracking and manage status.</p>
        </div>
        <PageSearch defaultValue={q} placeholder="Order number, name or email…" hidden={{ status }} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {STATUS_TABS.map((s) => (
          <Link key={s.k} href={`/admin/orders${qs({ status: s.k, page: '' })}`}
            className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${status === s.k ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'border border-[var(--color-line)] hover:bg-[var(--color-bone)]'}`}>
            {s.label}
          </Link>
        ))}
      </div>

      <p className="mt-4 text-sm text-[var(--color-stone)]">
        {total === 0 ? 'No orders' : pages > 1 ? `Page ${page} of ${pages} — ${total} orders` : `${total} ${total === 1 ? 'order' : 'orders'}`}
      </p>

      <div className="mt-3"><OrdersManager rows={rows} canManage={sessionCan(session, 'finance.manage')} emptyHint={q || status ? 'No orders match. Try a different search or status tab.' : undefined} /></div>

      {pages > 1 && (
        <nav className="mt-5 flex items-center justify-between gap-4" aria-label="Order list pages">
          <p className="text-sm text-[var(--color-stone)]">Page {page} of {pages}</p>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link href={`/admin/orders${qs({ page: String(page - 1) })}`} rel="prev" className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm transition-colors hover:bg-[var(--color-bone)]">← Prev</Link>
            ) : (
              <span aria-disabled className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm text-[var(--color-stone)] opacity-40">← Prev</span>
            )}
            {page < pages ? (
              <Link href={`/admin/orders${qs({ page: String(page + 1) })}`} rel="next" className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm transition-colors hover:bg-[var(--color-bone)]">Next →</Link>
            ) : (
              <span aria-disabled className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm text-[var(--color-stone)] opacity-40">Next →</span>
            )}
          </div>
        </nav>
      )}
    </AdminShell>
  );
}
