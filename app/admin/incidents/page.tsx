import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { getLocale } from '@/lib/locale';
import { listIncidentRegister } from '@/lib/incidents';
import { IncidentRegister } from '@/components/admin/IncidentRegister';

export const dynamic = 'force-dynamic';

// PRJ-1229.4 — clinic-wide incident (accident / adverse-reaction / RIDDOR)
// register. Before this page, incidents were only reachable one client at a
// time via GET /api/admin/incidents?clientId=... — an incident whose client
// has since been erased (GDPR right-to-erasure; Incident.client is
// onDelete: SetNull specifically so the record survives, kept under Art.
// 17(3)(b)'s legal-retention exception) had no clientId left to query by, so
// it became permanently unreachable. This page lists every incident,
// including those, via lib/incidents.ts's listIncidentRegister().
export default async function IncidentsPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  // BLD-1882: this register spans every client, so per-client practitioner
  // scoping can't apply. Same gate as GET /api/admin/incidents?all=1:
  // clients.clinical.view alone is every PRACTITIONER's default grant and
  // would expose other clinicians' patients' incident detail.
  if (!sessionCan(session, 'clients.clinical.view') || !sessionCan(session, 'compliance.manage')) redirect('/admin');

  const { rows, total } = await listIncidentRegister();

  if (session?.email) {
    try {
      const { logAudit } = await import('@/lib/audit');
      await logAudit({
        action: 'ASSESSMENT_VIEWED',
        actor: session.email,
        actorRole: session.role,
        summary: `Clinic-wide incidents register viewed (${rows.length} record${rows.length === 1 ? '' : 's'}${total > rows.length ? ` of ${total}` : ''})`,
      });
    } catch { /* audit is best-effort */ }
  }

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">Incidents register</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">
            Every accident, adverse reaction and RIDDOR-reportable incident logged across the clinic, newest first —
            including records for clients who have since been erased and are retained under UK GDPR&rsquo;s legal
            obligation exception (Art. 17(3)(b)).
          </p>
        </div>
      </div>
      <IncidentRegister rows={rows} total={total} />
    </AdminShell>
  );
}
