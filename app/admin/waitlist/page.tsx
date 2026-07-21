import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

// BLD-133 — staff visibility of the cancellation waitlist.
export default async function WaitlistPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'bookings.view')) redirect('/admin');
  const can = await sessionPermissions();
  const locale = await getLocale();

  const { db } = await import('@/lib/db');
  const rows = await db.waitlistEntry.findMany({
    where: { status: { in: ['ACTIVE', 'NOTIFIED'] } },
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    take: 200,
    include: { client: { select: { id: true, firstName: true, lastName: true, email: true } } },
  }).catch(() => []);

  const d = (x: Date) => new Date(x).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Waitlist</h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">
        Clients waiting for a slot to free up. When a matching appointment is cancelled, the first waiting client is emailed automatically.
      </p>

      <div className="mt-6 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-[var(--color-bone)] text-xs uppercase tracking-wide text-[var(--color-stone)]">
            <tr>{['Client', 'Treatment', 'Window', 'Status', 'Waiting since'].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-line)]">
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-5 text-[var(--color-stone)]">No one is on the waitlist right now.</td></tr>}
            {rows.map((w) => (
              <tr key={w.id} className="bg-[var(--color-porcelain)] align-top transition-colors duration-150 hover:bg-[var(--color-bone)]">
                <td className="px-4 py-3">
                  <a href={`/admin/clients/${w.client.id}`} className="font-medium hover:text-[var(--color-gold-deep)]">{[w.client.firstName, w.client.lastName].filter(Boolean).join(' ') || w.client.email}</a>
                </td>
                <td className="px-4 py-3">{w.treatmentTitle}</td>
                <td className="px-4 py-3 text-[var(--color-stone)]">{d(w.fromDate)}{+w.toDate !== +w.fromDate ? ` – ${d(w.toDate)}` : ''}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs ${w.status === 'NOTIFIED' ? 'bg-[var(--color-gold)]/20 text-[var(--color-ink)]' : 'bg-[var(--color-bone)] text-[var(--color-stone)]'}`}>{w.status === 'NOTIFIED' ? 'Notified' : 'Waiting'}</span>
                </td>
                <td className="px-4 py-3 text-[var(--color-stone)]">{d(w.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
