import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions, sessionCan } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';

export const dynamic = 'force-dynamic';

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const { q = '' } = await searchParams;
  const { listClients } = await import('@/lib/crm-data');
  const session = await getSession();
  if (!sessionCan(session, 'clients.view')) redirect('/admin');
  const rows = await listClients(q);

  const can = await sessionPermissions();
  return (
    <AdminShell user={session?.email} can={can}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Clients</h1>
        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name or email…"
            className="rounded-full border border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 py-2 text-sm outline-none focus:border-[var(--color-gold)]"
          />
          <button className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-porcelain)]">Search</button>
        </form>
      </div>

      <div className="mt-6 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
        {rows.length === 0 && <p className="p-6 text-sm text-[var(--color-stone)]">No clients found.</p>}
        {rows.map((c) => (
          <Link key={c.id} href={`/admin/clients/${c.id}`} className="grid grid-cols-[1fr_auto] gap-4 border-b border-[var(--color-line)] px-5 py-3.5 last:border-0 hover:bg-[var(--color-bone)] sm:grid-cols-[1.2fr_1.4fr_1fr_auto] sm:items-center">
            <p className="font-medium">{c.firstName} {c.lastName ?? ''}</p>
            <p className="hidden text-sm text-[var(--color-stone)] sm:block">{c.email}</p>
            <p className="hidden text-sm text-[var(--color-stone)] sm:block">{c.phone ?? '—'}</p>
            <div className="flex justify-end gap-1.5">
              {c.marketingOptIn && <span className="rounded-full bg-[var(--color-bone)] px-2.5 py-0.5 text-[0.65rem] uppercase tracking-wide text-[var(--color-stone)]">opt-in</span>}
            </div>
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}
