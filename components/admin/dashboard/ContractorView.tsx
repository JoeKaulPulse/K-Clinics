import 'server-only';
import { sessionCan, type Session } from '@/lib/auth';
import { db } from '@/lib/db';
import { fmtClinicDate } from '@/lib/clinic-time';
import { DashWidget } from './Widgets';
import { ContractorTasks, type ContractorTaskView } from '@/components/admin/ContractorTasks';
import { ContractorTaskAssign } from '@/components/admin/ContractorTaskAssign';
import { FacilityDocsViewer, type FacilityDocView } from '@/components/admin/FacilityDocsViewer';

// PRJ-63.7 — Contractor dashboard view. Strictly no client / clinical / financial
// data: contracted tasks, the staff clock, and the facility knowledge base. A
// manager previewing sees all open tasks; a contractor sees their own.

export async function ContractorView({ session }: { session: Session }) {
  const canManage = sessionCan(session, 'contractor.tasks.manage');
  const canFacility = sessionCan(session, 'facility.view');
  const now = new Date();

  const [taskRows, docsRaw, contractors] = await Promise.all([
    db.contractorTask.findMany({
      where: canManage ? {} : { assigneeId: session.sub },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
      take: 50,
      select: { id: true, title: true, description: true, status: true, dueAt: true, assignee: { select: { name: true, email: true } } },
    }).catch(() => []),
    canFacility ? db.facilityDoc.findMany({ orderBy: [{ type: 'asc' }, { order: 'asc' }] }).catch(() => []) : Promise.resolve([]),
    canManage ? db.adminUser.findMany({ where: { role: 'CONTRACTOR', active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, email: true } }).catch(() => []) : Promise.resolve([]),
  ]);
  const contractorOpts = contractors.map((c) => ({ id: c.id, name: c.name || c.email }));

  const tasks: ContractorTaskView[] = taskRows.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    dueLabel: t.dueAt ? fmtClinicDate(t.dueAt, { weekday: 'short', day: 'numeric', month: 'short' }) : null,
    overdue: !!t.dueAt && t.dueAt < now,
    assigneeName: t.assignee?.name || t.assignee?.email || null,
  }));
  const open = tasks.filter((t) => t.status !== 'DONE');
  const docs: FacilityDocView[] = docsRaw.map((d) => ({ id: d.id, title: d.title, type: d.type, fileUrl: d.fileUrl, isPdf: d.isPdf, description: d.description, tags: d.tags }));

  return (
    <div className="mt-6 space-y-6">
      {/* Contracted tasks (the clock + breaks live in the dashboard header aside) */}
      <DashWidget title={canManage ? 'Contracted tasks' : 'My tasks'} eyebrow={`${open.length} to do`}>
        {canManage && <ContractorTaskAssign contractors={contractorOpts} />}
        <ContractorTasks tasks={tasks} showAssignee={canManage} />
      </DashWidget>

      {/* Facility knowledge base */}
      {canFacility && (
        <DashWidget title="Facility" eyebrow="Plans · equipment · where things are">
          <FacilityDocsViewer docs={docs} canManage={false} />
        </DashWidget>
      )}
    </div>
  );
}
