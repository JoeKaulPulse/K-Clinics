export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PortalShell } from '@/components/portal/PortalShell';
import { crmEnabled } from '@/lib/crm';

export default async function AppointmentsPage() {
  if (!crmEnabled) redirect('/account');
  const { getCurrentClient } = await import('@/lib/client-auth');
  const { getDashboard } = await import('@/lib/portal-data');
  const client = await getCurrentClient();
  if (!client) redirect('/account/login');
  const { upcoming, past } = await getDashboard(client.id);

  return (
    <PortalShell firstName={client.firstName} locale={client.locale === 'uk' ? 'uk' : 'en'}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Appointments</p>
          <h1 className="font-[family-name:var(--font-display)] text-[clamp(1.8rem,1.3rem+2vw,2.75rem)]">Your visits</h1>
        </div>
        <Link href="/book" className="rounded-full bg-[var(--color-gold)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-ink)]">Book new</Link>
      </div>

      <h2 className="eyebrow mb-3">Upcoming</h2>
      {upcoming.length ? (
        <ul className="mb-10 grid gap-3">
          {upcoming.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5 shadow-[var(--shadow-soft)]">
              <div>
                <p className="font-[family-name:var(--font-display)] text-lg">{b.treatmentTitle}</p>
                <p className="text-sm text-[var(--color-stone)]">
                  {b.startAt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} ·{' '}
                  {b.startAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <Link href={`/booking/manage?token=${b.manageToken}`} className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-medium hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]">
                Reschedule / cancel
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-10 text-[var(--color-stone)]">No upcoming appointments. <Link href="/book" className="font-medium text-[var(--color-gold)]">Book now →</Link></p>
      )}

      <h2 className="eyebrow mb-3">Past</h2>
      {past.length ? (
        <ul className="grid gap-2">
          {past.map((b) => (
            <li key={b.id} className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-line)] px-5 py-3 text-sm">
              <span>{b.treatmentTitle}</span>
              <span className="text-[var(--color-stone)]">{b.startAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[var(--color-stone)]">No past visits yet.</p>
      )}
    </PortalShell>
  );
}
