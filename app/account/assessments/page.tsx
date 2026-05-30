export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PortalShell } from '@/components/portal/PortalShell';
import { crmEnabled } from '@/lib/crm';
import { portalAssessments } from '@/lib/questionnaires';

export default async function AssessmentsPage() {
  if (!crmEnabled) redirect('/account');

  const { getCurrentClient } = await import('@/lib/client-auth');
  const { assessmentStatus } = await import('@/lib/health-assessments');
  const client = await getCurrentClient();
  if (!client) redirect('/account/login');
  const statuses = await assessmentStatus(client.id);

  return (
    <PortalShell firstName={client.firstName}>
      <div className="mb-8">
        <p className="eyebrow mb-2">Health forms</p>
        <h1 className="font-[family-name:var(--font-display)] text-[clamp(1.8rem,1.3rem+2vw,2.75rem)]">Your assessments</h1>
        <p className="mt-2 max-w-xl text-[var(--color-stone)]">
          Complete these before your appointment. Every answer is encrypted and seen only by your clinical team.
        </p>
      </div>

      <div className="grid gap-4">
        {portalAssessments.map((q) => {
          const done = statuses.get(q.type);
          return (
            <div key={q.key} className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 shadow-[var(--shadow-soft)]">
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-xl">{q.title}</h2>
                <p className="mt-1 text-sm text-[var(--color-stone)]">
                  {done
                    ? `Completed ${done.submittedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : `About ${q.estMinutes} minutes`}
                </p>
              </div>
              <Link
                href={`/account/assessments/${q.key}`}
                className={`rounded-full px-5 py-2.5 text-sm font-medium ${done ? 'border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-gold)]' : 'bg-[var(--color-gold)] text-white hover:bg-[var(--color-ink)]'}`}
              >
                {done ? 'Update' : 'Start'}
              </Link>
            </div>
          );
        })}
      </div>
    </PortalShell>
  );
}
