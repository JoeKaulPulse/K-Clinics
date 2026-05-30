import Link from 'next/link';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';

export const dynamic = 'force-dynamic';

export default async function AdminOverview() {
  if (!crmEnabled) return <CrmDisabled />;
  const { getOverview } = await import('@/lib/crm-data');
  const session = await getSession();
  const o = await getOverview();

  const stats = [
    { label: 'Total clients', value: o.clients },
    { label: 'New consultations', value: o.newConsults, href: '/admin/consultations?status=NEW' },
    { label: 'Consults this week', value: o.weekConsults },
    { label: 'Marketing subscribers', value: o.marketingClients },
  ];

  const can = await sessionPermissions();
  return (
    <AdminShell user={session?.email} can={can}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Overview</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">Welcome back{session?.name ? `, ${session.name}` : ''}.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href || '#'}
            className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 transition-shadow hover:shadow-[var(--shadow-soft)]"
          >
            <p className="font-[family-name:var(--font-display)] text-4xl text-[var(--color-ink)]">{s.value}</p>
            <p className="mt-1 text-sm text-[var(--color-stone)]">{s.label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-display)] text-xl">Recent consultations</h2>
            <Link href="/admin/consultations" className="text-sm text-[var(--color-gold)] hover:underline">View all</Link>
          </div>
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
            {o.recentConsults.length === 0 && <p className="p-6 text-sm text-[var(--color-stone)]">No consultations yet.</p>}
            {o.recentConsults.map((c) => (
              <Link key={c.id} href={`/admin/clients/${c.clientId}`} className="flex items-center justify-between gap-4 border-b border-[var(--color-line)] px-5 py-3.5 last:border-0 hover:bg-[var(--color-bone)]">
                <div>
                  <p className="font-medium">{c.client.firstName} {c.client.lastName ?? ''}</p>
                  <p className="text-xs text-[var(--color-stone)]">{c.category} · {c.treatments.slice(0, 2).join(', ') || 'general'}</p>
                </div>
                <span className="rounded-full bg-[var(--color-bone)] px-3 py-1 text-xs">{c.status}</span>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">Upcoming birthdays</h2>
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
            {o.upcomingBirthdays.length === 0 && <p className="p-6 text-sm text-[var(--color-stone)]">None in the next two weeks.</p>}
            {o.upcomingBirthdays.map((b) => (
              <div key={b.id} className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-3 last:border-0">
                <span className="text-sm">{b.name}</span>
                <span className="text-xs text-[var(--color-stone)]">{b.date} · {b.inDays === 0 ? 'today' : `in ${b.inDays}d`}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
