import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { TaskBoard } from '@/components/admin/TaskBoard';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!session) redirect('/admin/login');

  const { db } = await import('@/lib/db');
  // Self-healing: tasks created before the reference scheme get a TSK-n ref on
  // first board load (new tasks are assigned one at creation).
  const { ensureTaskRefs } = await import('@/lib/task-refs');
  await ensureTaskRefs();

  const taskInclude = {
    assignee: { select: { name: true, email: true } },
    client: { select: { id: true, firstName: true, lastName: true } },
    parent: { select: { ref: true, title: true } },
  } as const;
  const [open, done, staff] = await Promise.all([
    db.task.findMany({
      where: { status: 'OPEN' },
      orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: 200,
      include: taskInclude,
    }),
    db.task.findMany({
      where: { status: 'DONE' },
      orderBy: { completedAt: 'desc' },
      take: 20,
      include: taskInclude,
    }),
    db.adminUser.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, email: true } }),
  ]);

  const shape = (t: (typeof open)[number]) => ({
    id: t.id, ref: t.ref, title: t.title, detail: t.detail, status: t.status as string, priority: t.priority as string,
    dueAt: t.dueAt ? t.dueAt.toISOString() : null, assigneeId: t.assigneeId,
    assigneeName: t.assignee?.name || t.assignee?.email || null,
    createdBy: t.createdBy, completedAt: t.completedAt ? t.completedAt.toISOString() : null, completedBy: t.completedBy,
    clientId: t.clientId, clientName: t.client ? [t.client.firstName, t.client.lastName].filter(Boolean).join(' ') : null,
    parentId: t.parentId, parentRef: t.parent?.ref || null,
  });

  const can = await sessionPermissions();
  const locale = await getLocale();
  const uk = locale === 'uk';

  return (
    <AdminShell user={session.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">{uk ? 'Завдання' : 'Tasks'}</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">
        {uk ? 'Внутрішні завдання команди — призначайте, встановлюйте терміни та відстежуйте виконання.' : 'Internal team tasks — assign them, set due dates and track completion.'}
      </p>
      <div className="mt-8">
        <TaskBoard
          meId={session.sub}
          staff={staff.map((s) => ({ id: s.id, name: s.name || s.email }))}
          open={open.map(shape)}
          done={done.map(shape)}
          uk={uk}
        />
      </div>
    </AdminShell>
  );
}
