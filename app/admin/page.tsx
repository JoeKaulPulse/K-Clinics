import Link from 'next/link';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions } from '@/lib/auth';
import { formatPrice } from '@/lib/treatments';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';

export const dynamic = 'force-dynamic';

export default async function AdminOverview() {
  if (!crmEnabled) return <CrmDisabled />;
  const { getOverview, getAnalytics } = await import('@/lib/crm-data');
  const session = await getSession();
  const [o, a] = await Promise.all([getOverview(), getAnalytics()]);

  const kpis = [
    { label: 'Revenue · 30 days', value: formatPrice(a.rev30), trend: a.revTrend, href: '/admin/bookings' },
    { label: 'Upcoming appointments', value: String(a.upcomingCount), href: '/admin/bookings' },
    { label: 'Consult → booking', value: `${a.conversion}%`, sub: 'last 30 days' },
    { label: 'New clients · 30 days', value: String(a.newClients30), href: '/admin/clients' },
  ];

  const can = await sessionPermissions();
  return (
    <AdminShell user={session?.email} can={can}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Overview</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">Welcome back{session?.name ? `, ${session.name}` : ''}.</p>

      {/* KPI row */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Link
            key={k.label}
            href={k.href || '#'}
            className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 transition-shadow hover:shadow-[var(--shadow-soft)]"
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-[family-name:var(--font-display)] text-3xl text-[var(--color-ink)]">{k.value}</p>
              {typeof k.trend === 'number' && (
                <span className={`text-xs font-medium ${k.trend >= 0 ? 'text-[var(--color-jade)]' : 'text-[var(--color-blush)]'}`}>
                  {k.trend >= 0 ? '▲' : '▼'} {Math.abs(k.trend)}%
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-[var(--color-stone)]">{k.label}{k.sub ? ` · ${k.sub}` : ''}</p>
          </Link>
        ))}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        {/* Today's schedule */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-display)] text-xl">Today’s schedule</h2>
            <Link href="/admin/bookings" className="text-sm text-[var(--color-gold)] hover:underline">All bookings</Link>
          </div>
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
            {a.today.length === 0 && <p className="p-6 text-sm text-[var(--color-stone)]">No appointments today.</p>}
            {a.today.map((b) => (
              <Link key={b.id} href={`/admin/bookings/${b.id}`} className="flex items-center gap-4 border-b border-[var(--color-line)] px-5 py-3.5 last:border-0 hover:bg-[var(--color-bone)]">
                <span className="w-14 shrink-0 font-[family-name:var(--font-display)] text-lg text-[var(--color-gold)]">{b.time}</span>
                <div className="flex-1">
                  <p className="font-medium">{b.treatment}</p>
                  <p className="text-xs text-[var(--color-stone)]">{b.client}</p>
                </div>
                <span className="rounded-full bg-[var(--color-bone)] px-3 py-1 text-xs">{b.status.toLowerCase()}</span>
              </Link>
            ))}
          </div>

          <div className="mb-3 mt-8 flex items-center justify-between">
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

        <section className="space-y-8">
          <div>
            <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">At a glance</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total clients', value: o.clients },
                { label: 'New consults', value: o.newConsults },
                { label: 'This week', value: o.weekConsults },
                { label: 'Subscribers', value: o.marketingClients },
              ].map((s) => (
                <div key={s.label} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
                  <p className="font-[family-name:var(--font-display)] text-2xl">{s.value}</p>
                  <p className="text-xs text-[var(--color-stone)]">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
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
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
