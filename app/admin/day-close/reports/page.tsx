import { redirect } from 'next/navigation';
import Link from 'next/link';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { getLocale } from '@/lib/locale';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { DayCloseSettings } from '@/components/admin/DayCloseSettings';
import { getDayCloseConfig, listCloses, money } from '@/lib/day-close';

export const dynamic = 'force-dynamic';

export default async function DayCloseReportsPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'dayclose.manage')) redirect('/admin');

  const can = await sessionPermissions();
  const locale = await getLocale();
  const [config, closes] = await Promise.all([getDayCloseConfig(), listCloses(60)]);

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">Day-close reports &amp; settings</h1>
          <p className="mt-1 text-sm text-[var(--color-stone)]">Review past close-outs and configure the closedown tasks &amp; reminders.</p>
        </div>
        <Link href="/admin/day-close" className="shrink-0 rounded-full border border-[var(--color-line)] px-4 py-2 text-sm hover:bg-[var(--color-bone)]">
          Run close-down
        </Link>
      </div>

      {/* Close-out reports */}
      <section className="mt-8">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Close-out reports</h2>
        {closes.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-stone)]">No close-downs recorded yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--color-bone)] text-xs uppercase tracking-wide text-[var(--color-stone)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Card takings</th>
                  <th className="px-4 py-3 font-medium">Cash takings</th>
                  <th className="px-4 py-3 font-medium">Total takings</th>
                  <th className="px-4 py-3 font-medium">Variance</th>
                  <th className="px-4 py-3 font-medium">Checks</th>
                  <th className="px-4 py-3 font-medium">Closed by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {closes.map((c) => {
                  const v = c.variancePence ?? 0;
                  return (
                    <tr key={c.id} className="align-top">
                      <td className="px-4 py-3 whitespace-nowrap">{new Date(c.businessDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                      <td className="px-4 py-3">{c.location?.name || '—'}</td>
                      <td className="px-4 py-3 tabular-nums">{money(c.expectedCardPence)}</td>
                      <td className="px-4 py-3 tabular-nums">{money(c.cashTakingsPence ?? 0)}</td>
                      <td className="px-4 py-3 font-medium tabular-nums">{money(c.expectedCardPence + (c.cashTakingsPence ?? 0))}</td>
                      <td className={`px-4 py-3 tabular-nums ${v === 0 ? 'text-[var(--color-jade)]' : 'text-[var(--color-blush)]'}`}>{v === 0 ? 'Balanced' : money(v)}</td>
                      <td className="px-4 py-3 tabular-nums">{c.checklistDone}/{c.checklistTotal}</td>
                      <td className="px-4 py-3 text-[var(--color-stone)]">
                        {c.completedBy || '—'}
                        {c.notes && <span className="mt-0.5 block text-xs italic">“{c.notes}”</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Task & reminder configuration */}
      <section className="mt-12">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Closedown configuration</h2>
        <p className="mb-5 mt-1 text-sm text-[var(--color-stone)]">Tailor the checklist and reminder times for how this clinic shuts down.</p>
        <DayCloseSettings initial={config} />
      </section>
    </AdminShell>
  );
}
