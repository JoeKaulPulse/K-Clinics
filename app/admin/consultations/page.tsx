import Link from 'next/link';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';

export const dynamic = 'force-dynamic';

const STATUSES = ['ALL', 'NEW', 'CONTACTED', 'BOOKED', 'COMPLETED', 'CLOSED'];

export default async function ConsultationsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const { status = 'ALL' } = await searchParams;
  const { listConsultations } = await import('@/lib/crm-data');
  const session = await getSession();
  const rows = await listConsultations(status);

  const can = await sessionPermissions();
  return (
    <AdminShell user={session?.email} can={can}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Consultations</h1>

      <div className="mt-6 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/consultations?status=${s}`}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${status === s ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'border border-[var(--color-line)] hover:bg-[var(--color-bone)]'}`}
          >
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </Link>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
        {rows.length === 0 && <p className="p-6 text-sm text-[var(--color-stone)]">No consultations in this view.</p>}
        {rows.map((c) => (
          <Link key={c.id} href={`/admin/clients/${c.clientId}`} className="grid grid-cols-[1fr_auto] gap-4 border-b border-[var(--color-line)] px-5 py-4 last:border-0 hover:bg-[var(--color-bone)] sm:grid-cols-[1.2fr_1.4fr_0.8fr_auto] sm:items-center">
            <div>
              <p className="font-medium">{c.client.firstName} {c.client.lastName ?? ''}</p>
              <p className="text-xs text-[var(--color-stone)]">{c.client.email}</p>
            </div>
            <p className="hidden text-sm text-[var(--color-stone)] sm:block">{c.treatments.join(', ') || c.category}</p>
            <p className="hidden text-xs text-[var(--color-stone)] sm:block">{new Date(c.createdAt).toLocaleDateString('en-GB')}</p>
            <span className="justify-self-end rounded-full bg-[var(--color-bone)] px-3 py-1 text-xs">{c.status}</span>
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}
