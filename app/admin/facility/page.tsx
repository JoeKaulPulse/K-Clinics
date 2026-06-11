import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions, sessionCan } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { FacilityDocsViewer, type FacilityDocView } from '@/components/admin/FacilityDocsViewer';
import { FacilityUpload } from '@/components/admin/FacilityUpload';

export const dynamic = 'force-dynamic';

// PRJ-63 — Facility knowledge base. Plans, equipment locations and instructions
// for the whole team (and the contractor view). No client/clinical data.
export default async function FacilityPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!session) redirect('/admin/login');
  if (!sessionCan(session, 'facility.view')) redirect('/admin');

  const can = await sessionPermissions();
  const canManage = sessionCan(session, 'facility.manage');
  const { db } = await import('@/lib/db');
  const [docsRaw, locations] = await Promise.all([
    db.facilityDoc.findMany({ orderBy: [{ type: 'asc' }, { order: 'asc' }, { createdAt: 'desc' }] }).catch(() => []),
    db.location.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }).catch(() => []),
  ]);
  const docs: FacilityDocView[] = docsRaw.map((d) => ({ id: d.id, title: d.title, type: d.type, fileUrl: d.fileUrl, isPdf: d.isPdf, description: d.description, tags: d.tags }));

  return (
    <AdminShell user={session.email} can={can}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">Facility</h1>
          <p className="mt-1 text-sm text-[var(--color-stone)]">Plans, equipment locations and where-to-find-things for the team.</p>
        </div>
      </div>

      {canManage && <div className="mt-6"><FacilityUpload locations={locations} /></div>}

      <div className="mt-8">
        <FacilityDocsViewer docs={docs} canManage={canManage} />
      </div>
    </AdminShell>
  );
}
