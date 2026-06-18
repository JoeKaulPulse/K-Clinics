import 'server-only';
import Link from 'next/link';
import { sessionCan, type Session } from '@/lib/auth';
import { db } from '@/lib/db';
import { fmtClinicDate } from '@/lib/clinic-time';
import { DashWidget, TimelineList, type TimelineItem } from './Widgets';
import { ContractorTasks, type ContractorTaskView } from '@/components/admin/ContractorTasks';

// PRJ-63.12 — My Day focus for the two work roles whose day is NOT appointment-shaped.
// The dashboard views (DeveloperView/ContractorView) are clinic-wide; My Day is the
// person's own work for the day. No client / clinical / financial data is read here.

const OPEN_STATES = ['TRIAGE', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED'] as const;
const URGENCY_CLS: Record<string, string> = {
  P0: 'bg-[color-mix(in_oklab,#c0392b_16%,transparent)] text-[#b23b3b]',
  P1: 'bg-amber-100 text-amber-800',
  P2: 'bg-[var(--color-bone)] text-[var(--color-stone)]',
  P3: 'bg-[var(--color-bone)] text-[var(--color-stone)]',
};

// Developer My Day: the items assigned to THIS developer (by email), most-urgent
// first — the personal focus list, distinct from the clinic-wide DeveloperView.
export async function DeveloperMyDay({ session }: { session: Session }) {
  if (!sessionCan(session, 'build.view')) return null;
  const mine = await db.buildItem
    .findMany({
      where: { assignee: session.email, status: { in: [...OPEN_STATES] } },
      orderBy: [{ urgency: 'asc' }, { createdAt: 'asc' }],
      take: 15,
      select: { id: true, ref: true, title: true, status: true, urgency: true, type: true },
    })
    .catch(() => []);

  const items: TimelineItem[] = mine.map((i) => ({
    id: i.id,
    lead: <span className="text-xs font-semibold tabular-nums text-[var(--color-stone)]">{i.ref ?? '—'}</span>,
    title: i.title,
    meta: [i.type === 'ERROR' ? '⚠ error' : null, i.status.toLowerCase().replace('_', ' ')].filter(Boolean).join(' · '),
    href: '/admin/build',
    trailing: <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${URGENCY_CLS[i.urgency] ?? URGENCY_CLS.P2}`}>{i.urgency}</span>,
  }));

  return (
    <div className="mt-2 space-y-6">
      <DashWidget
        title="My focus today"
        eyebrow={`${mine.length} item${mine.length === 1 ? '' : 's'} assigned to you`}
        action={<Link href="/admin/build" className="text-sm text-[var(--color-gold)] hover:underline">Open board →</Link>}
      >
        <TimelineList items={items} empty="Nothing assigned to you right now — pick up an item from the board." />
      </DashWidget>
    </div>
  );
}

// Contractor My Day: their own contracted jobs, soonest-due first. The time clock
// sits directly below on the My Day page, so it isn't repeated here.
export async function ContractorMyDay({ session }: { session: Session }) {
  const now = new Date();
  const rows = await db.contractorTask
    .findMany({
      where: { assigneeId: session.sub },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
      take: 50,
      select: { id: true, title: true, description: true, status: true, dueAt: true },
    })
    .catch(() => []);

  const tasks: ContractorTaskView[] = rows.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    dueLabel: t.dueAt ? fmtClinicDate(t.dueAt, { weekday: 'short', day: 'numeric', month: 'short' }) : null,
    overdue: !!t.dueAt && t.dueAt < now && t.status !== 'DONE',
    assigneeName: null,
  }));
  const open = tasks.filter((t) => t.status !== 'DONE');

  return (
    <div className="mt-2 space-y-6">
      <DashWidget title="My jobs" eyebrow={`${open.length} to do`}>
        <ContractorTasks tasks={tasks} showAssignee={false} />
      </DashWidget>
    </div>
  );
}
