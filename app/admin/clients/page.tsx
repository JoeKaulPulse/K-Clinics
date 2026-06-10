import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions, sessionCan } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { PageSearch } from '@/components/admin/PageSearch';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { getLocale } from '@/lib/locale';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

type SP = { q?: string; sort?: string; dir?: 'asc' | 'desc'; flag?: string };

const FLAGS = [
  { k: '', label: 'All' },
  { k: 'optin', label: 'Marketing opt-in' },
  { k: 'review', label: 'Needs name review' },
  { k: 'likelytest', label: 'Likely test/junk' },
  { k: 'wordpress', label: 'Imported' },
];

export default async function ClientsPage({ searchParams }: { searchParams: Promise<SP> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const { q = '', sort = 'created', dir = 'desc', flag = '' } = await searchParams;
  const { listClients } = await import('@/lib/crm-data');
  const session = await getSession();
  if (!sessionCan(session, 'clients.view')) redirect('/admin');
  const rows = await listClients({ q, sort, dir, flag });

  const can = await sessionPermissions();
  const locale = await getLocale();

  // Build a querystring preserving current params, overriding some.
  const qs = (over: Partial<SP>) => {
    const p = new URLSearchParams();
    const merged = { q, sort, dir, flag, ...over };
    if (merged.q) p.set('q', merged.q);
    if (merged.sort) p.set('sort', merged.sort);
    if (merged.dir) p.set('dir', merged.dir);
    if (merged.flag) p.set('flag', merged.flag);
    const s = p.toString();
    return s ? `?${s}` : '';
  };
  // A sortable column header: toggles direction if already active.
  const SortHead = ({ col, label, className = '' }: { col: string; label: string; className?: string }) => {
    const active = sort === col;
    const nextDir = active && dir === 'asc' ? 'desc' : 'asc';
    return (
      <Link href={`/admin/clients${qs({ sort: col, dir: nextDir })}`} className={`group inline-flex items-center gap-1 ${className}`}>
        {label}
        <span className={active ? 'text-[var(--color-gold)]' : 'opacity-0 group-hover:opacity-40'}>{active && dir === 'asc' ? '↑' : '↓'}</span>
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
          <p className="mt-1 text-sm text-[var(--color-stone)]">{rows.length}{rows.length === 200 ? '+' : ''} {rows.length === 1 ? 'client' : 'clients'}</p>
        </div>
        <PageSearch
          defaultValue={q}
          placeholder="Search name, email or phone…"
          hidden={{ flag, sort, dir }}
        />
      </div>

      {/* Filters */}
      <div className="mt-5 flex flex-wrap gap-2">
        {FLAGS.map((f) => (
          <Link key={f.k} href={`/admin/clients${qs({ flag: f.k })}`}
            className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${flag === f.k ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'border border-[var(--color-line)] hover:bg-[var(--color-bone)]'}`}>
            {f.label}
          </Link>
        ))}
      </div>

      <div className="mt-5 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
        {/* Header row */}
        <div className={`${rowCls} bg-[var(--color-bone)] text-xs uppercase tracking-[0.12em] text-[var(--color-stone)]`}>
          <SortHead col="name" label="Name" />
          <SortHead col="email" label="Email" className="hidden sm:inline-flex" />
          <span className="hidden sm:block">Phone</span>
          <SortHead col="created" label="Added" className="hidden sm:inline-flex" />
          <span className="justify-self-end">Flags</span>
        </div>
        {rows.length === 0 && <p className="p-6 text-sm text-[var(--color-stone)]">No clients found.</p>}
        {rows.map((c) => {
          const review = c.tags?.includes('needs-name-review');
          const test = c.tags?.includes('likely-test');
          return (
            <Link key={c.id} href={`/admin/clients/${c.id}`} className={`${rowCls} hover:bg-[var(--color-bone)]`}>
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
    </AdminShell>
  );
}
