import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSetting } from '@/lib/settings';
import { currentVisit } from '@/app/contractor/actions';
import { FacilityDocsViewer, type FacilityDocView } from '@/components/admin/FacilityDocsViewer';
import { ContractorTaskList, type MyTaskView } from '@/components/contractor/TaskStatus';
import { VisitTimer } from '@/components/contractor/VisitTimer';
import { CheckOutButton } from '@/components/contractor/CheckOutButton';

export const dynamic = 'force-dynamic';

// PRJ-63 — PUBLIC on-site view for a checked-in contractor.
//
// SECURITY: the ONLY things this page queries/renders are (1) the contractor's
// own name, (2) their OWN assigned ContractorTask rows, (3) FacilityDoc rows
// (shared building plans/instructions), and (4) their visit timer. It NEVER
// queries client, clinical, financial, booking or staff data. The visit is
// resolved + verified (timing-safe secret) by currentVisit(); contractorId comes
// from that verified row, never from the client.
export default async function ContractorSitePage() {
  if (!(await getSetting('contractor_checkin_enabled'))) redirect('/contractor');

  const session = await currentVisit();
  if (!session) redirect('/contractor');

  const { contractor, visit } = session;

  // Scope tasks strictly to THIS contractor's id (from the verified visit row).
  const [tasksRaw, docsRaw] = await Promise.all([
    db.contractorTask.findMany({
      where: { contractorId: contractor.id },
      select: { id: true, title: true, description: true, status: true, dueAt: true },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
    }).catch(() => []),
    db.facilityDoc.findMany({
      orderBy: [{ type: 'asc' }, { order: 'asc' }, { createdAt: 'desc' }],
      select: { id: true, title: true, type: true, fileUrl: true, isPdf: true, description: true, tags: true },
    }).catch(() => []),
  ]);

  const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
  const now = Date.now();
  const tasks: MyTaskView[] = tasksRaw.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    dueLabel: t.dueAt ? dateFmt.format(t.dueAt) : null,
    overdue: !!t.dueAt && t.dueAt.getTime() < now,
  }));
  const docs: FacilityDocView[] = docsRaw.map((d) => ({
    id: d.id, title: d.title, type: d.type, fileUrl: d.fileUrl, isPdf: d.isPdf, description: d.description, tags: d.tags,
  }));

  const firstName = contractor.name.split(' ')[0] || contractor.name;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-[var(--color-gold-deep)]">On site</p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl">Hello, {firstName}</h1>
        </div>
        <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 py-2 text-center">
          <p className="text-[0.65rem] uppercase tracking-[0.12em] text-[var(--color-stone)]">On site for</p>
          <p className="text-lg">
            <VisitTimer since={visit.checkedInAt.toISOString()} />
          </p>
        </div>
      </header>

      {contractor.status === 'PENDING' && (
        <div className="mt-6 rounded-[var(--radius-md)] border border-[#e8d6b0] bg-[#fbf3e2] px-4 py-3 text-sm text-[#7a5c1e]">
          <strong className="font-semibold">Awaiting approval.</strong> Your profile is new — please see reception to be approved. You can still view your jobs and the building plans below.
        </div>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-stone)]">Your jobs</h2>
        <ContractorTaskList tasks={tasks} />
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-stone)]">Building plans &amp; instructions</h2>
        <FacilityDocsViewer docs={docs} />
      </section>

      <div className="mt-12">
        <CheckOutButton />
      </div>
    </main>
  );
}
