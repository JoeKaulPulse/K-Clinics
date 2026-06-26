import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions, sessionCan } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { PageSearch } from '@/components/admin/PageSearch';
import { ScanTestClientsButton } from '@/components/admin/ScanTestClientsButton';
import { EmptyState } from '@/components/admin/EmptyState';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { getLocale } from '@/lib/locale';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

type SP = { q?: string; sort?: string; dir?: 'asc' | 'desc'; flag?: string; page?: string; showtest?: string };

const FLAGS = [
  { k: '', label: 'All' },
  { k: 'optin', label: 'Marketing opt-in' },
  { k: 'review', label: 'Needs name review' },
  { k: 'likelytest', label: 'Likely test/junk' },
  { k: 'wordpress', label: 'Imported' },
];

export default async function ClientsPage({ searchParams }: { searchParams: Promise<SP> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const { q = '', sort = 'created', dir = 'desc', flag = '', page: pageParam, showtest } = await searchParams;
  const reqPage = Math.max(1, Number(pageParam) || 1);
  const includeTest = showtest === '1';
  const { listClients } = await import('@/lib/crm-data');
  const session = await getSession();
  if (!sessionCan(session, 'clients.view')) redirect('/admin');
  const { rows, total, page, pages, perPage, hiddenTest } = await listClients({ q, sort, dir, flag, page: reqPage, includeTest });
  const canEdit = sessionCan(session, 'clients.edit');

  const can = await sessionPermissions();
  const locale = await getLocale();

  // Build a querystring preserving current params, overriding some. Changing the
  // search, sort or filter drops `page` so the user lands back on page 1; only
  // the Prev/Next links carry a page through (they pass it explicitly).
  const qs = (over: Partial<SP>) => {
    const p = new URLSearchParams();
    const merged = { q, sort, dir, flag, showtest: includeTest ? '1' : '', ...over };
    if (merged.q) p.set('q', merged.q);
    if (merged.sort) p.set('sort', merged.sort);
    if (merged.dir) p.set('dir', merged.dir);
    if (merged.flag) p.set('flag', merged.flag);
    if (merged.showtest === '1') p.set('showtest', '1');
    if (merged.page && Number(merged.page) > 1) p.set('page', String(merged.page));
    const s = p.toString();
    return s ? `?${s}` : '';
  };
  const firstOnPage = total === 0 ? 0 : (page - 1) * perPage + 1;
  const lastOnPage = (page - 1) * perPage + rows.length;
  // A sortable column header: toggles direction if already active.
  const SortHead = ({ col, label, className = '' }: { col: string; label: string; className?: string }) => {
    const active = sort === col;
    const nextDir = active && dir === 'asc' ? 'desc' : 'asc';
    // This is a div-based grid, not a semantic <table>, so aria-sort would be invalid
    // without full grid roles. An aria-label on the link conveys the sort action +
    // current state to screen readers; the arrow glyph is decorative (aria-hidden).
    const stateLabel = active ? `, currently sorted ${dir === 'asc' ? 'ascending' : 'descending'}` : '';
    return (
      <Link
        href={`/admin/clients${qs({ sort: col, dir: nextDir })}`}
        aria-label={`Sort by ${label}${stateLabel}`}
        className={`group inline-flex items-center gap-1 ${className}`}
      >
        {label}
        <span aria-hidden className={active ? 'text-[var(--color-gold)]' : 'opacity-0 group-hover:opacity-40'}>{active && dir === 'asc' ? '↑' : '↓'}</span>
      </Link>
    );
  };

  const fmtDate = (d: Date | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const rowCls = 'grid grid-cols-[1fr_auto] gap-4 border-b border-[var(--color-line)] px-5 py-3 last:border-0 sm:grid-cols-[1.4fr_1.7fr_1fr_0.9fr_auto] sm:items-center';

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">{t(locale, 'nav.clients')}</h1>
          <p className="mt-1 text-sm text-[var(--color-stone)]">
            {total === 0 ? 'No clients' : pages > 1 ? `${firstOnPage}–${lastOnPage} of ${total} ${total === 1 ? 'client' : 'clients'}` : `${total} ${total === 1 ? 'client' : 'clients'}`}
          </p>
        </div>
        <PageSearch
          defaultValue={q}
          placeholder="Search name, email or phone…"
          hidden={{ flag, sort, dir }}
        />
      </div>

      {/* Filters */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {FLAGS.map((f) => (
          <Link key={f.k} href={`/admin/clients${qs({ flag: f.k, page: '' })}`}
            className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${flag === f.k ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'border border-[var(--color-line)] hover:bg-[var(--color-bone)]'}`}>
            {f.label}
          </Link>
        ))}
        {canEdit && <ScanTestClientsButton />}
      </div>

      {/* BLD-561: likely test/junk records are hidden from this list by default;
          surface the count with a one-click reveal (nothing is deleted). */}
      {flag !== 'likelytest' && (hiddenTest > 0 || includeTest) && (
        <p className="mt-3 text-sm text-[var(--color-stone)]">
          {includeTest
            ? <>Showing {total} including test/junk records · <Link href={`/admin/clients${qs({ showtest: '', page: '' })}`} className="text-[var(--color-gold)] hover:underline">Hide them</Link></>
            : <>{hiddenTest} likely test/junk {hiddenTest === 1 ? 'record is' : 'records are'} hidden · <Link href={`/admin/clients${qs({ showtest: '1', page: '' })}`} className="text-[var(--color-gold)] hover:underline">Show</Link> · <Link href={`/admin/clients${qs({ flag: 'likelytest', page: '' })}`} className="text-[var(--color-gold)] hover:underline">Review them</Link></>}
        </p>
      )}

      <div className="mt-5 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] tabular-nums">
        {/* Header row */}
        <div className={`${rowCls} bg-[var(--color-bone)] text-xs uppercase tracking-[0.12em] text-[var(--color-stone)]`}>
          <SortHead col="name" label="Name" />
          <SortHead col="email" label="Email" className="hidden sm:inline-flex" />
          <span className="hidden sm:block">Phone</span>
          <SortHead col="created" label="Added" className="hidden sm:inline-flex" />
          <span className="justify-self-end">Flags</span>
        </div>
        {rows.length === 0 && (
          <EmptyState
            title={q || flag ? 'No matching clients' : 'No clients yet'}
            hint={q || flag ? 'Try a different name, email or phone — or clear the filters above.' : 'Clients appear here automatically when someone books, enquires or signs up.'}
            icon={<><circle cx="9" cy="7" r="3" /><path d="M3.5 19a6 6 0 0 1 11 0" /><path d="M17 11h4M19 9v4" /></>}
          />
        )}
        {rows.map((c) => {
          const review = c.tags?.includes('needs-name-review');
          const test = c.tags?.includes('likely-test');
          return (
            <Link key={c.id} href={`/admin/clients/${c.id}`} className={`${rowCls} transition-colors duration-150 ease-out hover:bg-[var(--color-bone)] active:bg-[var(--color-sand)]`}>
              <p className="font-medium">{c.firstName} {c.lastName ?? ''}</p>
              <p className="hidden truncate text-sm text-[var(--color-stone)] sm:block">{c.email}</p>
              <p className="hidden text-sm text-[var(--color-stone)] sm:block">{c.phone ?? '—'}</p>
              <p className="hidden text-sm text-[var(--color-stone)] sm:block">{fmtDate(c.createdAt)}</p>
              <div className="flex flex-wrap justify-end gap-1.5">
                {test && <span className="rounded-full bg-[color-mix(in_oklab,#c0392b_18%,transparent)] px-2.5 py-0.5 text-[0.65rem] uppercase tracking-wide text-[var(--color-ink)]" title="Looks like an old test/junk signup — review and archive">test</span>}
                {review && <span className="rounded-full bg-[color-mix(in_oklab,#d9a441_22%,transparent)] px-2.5 py-0.5 text-[0.65rem] uppercase tracking-wide text-[var(--color-ink)]" title="No real name in the imported data — please review">review</span>}
                {c.marketingOptIn && <span className="rounded-full bg-[var(--color-bone)] px-2.5 py-0.5 text-[0.65rem] uppercase tracking-wide text-[var(--color-stone)]">opt-in</span>}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Pagination — only when there's more than one page. Prev/Next carry the
          current search, sort and filter forward (BLD-621). */}
      {pages > 1 && (
        <nav className="mt-5 flex items-center justify-between gap-4" aria-label="Client list pages">
          <p className="text-sm text-[var(--color-stone)]">Page {page} of {pages}</p>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link href={`/admin/clients${qs({ page: String(page - 1) })}`} rel="prev" className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm transition-colors hover:bg-[var(--color-bone)]">← Prev</Link>
            ) : (
              <span aria-disabled className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm text-[var(--color-stone)] opacity-40">← Prev</span>
            )}
            {page < pages ? (
              <Link href={`/admin/clients${qs({ page: String(page + 1) })}`} rel="next" className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm transition-colors hover:bg-[var(--color-bone)]">Next →</Link>
            ) : (
              <span aria-disabled className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm text-[var(--color-stone)] opacity-40">Next →</span>
            )}
          </div>
        </nav>
      )}
    </AdminShell>
  );
}
