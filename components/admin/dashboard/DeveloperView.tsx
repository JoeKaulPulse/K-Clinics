import 'server-only';
import Link from 'next/link';
import { sessionCan, type Session } from '@/lib/auth';
import { db } from '@/lib/db';
import { DashWidget, StatTile, TimelineList, EmptyWidget, type TimelineItem } from './Widgets';

// PRJ-63.6 — Developer dashboard view. Build board + platform, nothing else: the
// DEVELOPER role has dashboard/build/platform-status only, so this view never
// reads client, clinical or financial data. Build-board snapshot + top open items,
// error reports newest-first, and quick links out to GitHub / deploys / status.

const OPEN_STATES = ['TRIAGE', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED'] as const;
const REPO_URL = 'https://github.com/JoeKaulPulse/K-Clinics';
const VERCEL_URL = 'https://vercel.com/kaul-joe/k-clinics';

const URGENCY_CLS: Record<string, string> = {
  P0: 'bg-[color-mix(in_oklab,#c0392b_16%,transparent)] text-[#b23b3b]',
  P1: 'bg-amber-100 text-amber-800',
  P2: 'bg-[var(--color-bone)] text-[var(--color-stone)]',
  P3: 'bg-[var(--color-bone)] text-[var(--color-stone-soft)]',
};

export async function DeveloperView({ session }: { session: Session }) {
  const canBuild = sessionCan(session, 'build.view');
  const canStatus = sessionCan(session, 'platform.status');

  if (!canBuild) {
    return (
      <div className="mt-6">
        <DashWidget><EmptyWidget title="Build board unavailable" hint="You don’t have permission to view the build & issues board." /></DashWidget>
      </div>
    );
  }

  const [open, inReview, blocked, notOnGithub, topItems, errors] = await Promise.all([
    db.buildItem.count({ where: { status: { in: [...OPEN_STATES] } } }).catch(() => 0),
    db.buildItem.count({ where: { status: 'IN_REVIEW' } }).catch(() => 0),
    db.buildItem.count({ where: { status: 'BLOCKED' } }).catch(() => 0),
    db.buildItem.count({ where: { status: { in: [...OPEN_STATES] }, githubUrl: null } }).catch(() => 0),
    db.buildItem.findMany({
      where: { status: { in: [...OPEN_STATES] } },
      orderBy: [{ urgency: 'asc' }, { createdAt: 'asc' }],
      take: 6,
      select: { id: true, ref: true, title: true, status: true, urgency: true },
    }).catch(() => []),
    db.buildItem.findMany({
      where: { type: 'ERROR', status: { in: [...OPEN_STATES] } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, ref: true, title: true, urgency: true, reportedBy: true, createdAt: true },
    }).catch(() => []),
  ]);

  const toItem = (i: { id: string; ref: string | null; title: string; status?: string; urgency: string }): TimelineItem => ({
    id: i.id,
    lead: <span className="text-xs font-semibold tabular-nums text-[var(--color-stone)]">{i.ref ?? '—'}</span>,
    title: i.title,
    meta: i.status ? i.status.toLowerCase().replace('_', ' ') : undefined,
    href: '/admin/build',
    trailing: <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${URGENCY_CLS[i.urgency] ?? URGENCY_CLS.P2}`}>{i.urgency}</span>,
  });

  const links: { href: string; label: string; external?: boolean; show: boolean }[] = [
    { href: '/admin/build', label: 'Build & issues board', show: true },
    { href: '/admin/status', label: 'Platform status & health', show: canStatus },
    { href: REPO_URL, label: 'GitHub repository', external: true, show: true },
    { href: VERCEL_URL, label: 'Deployments (Vercel)', external: true, show: true },
  ];

  return (
    <div className="mt-6 space-y-6">
      {/* Build-board snapshot */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Open" value={open} href="/admin/build" />
        <StatTile label="In review" value={inReview} href="/admin/build" />
        <StatTile label="Blocked" value={blocked} href="/admin/build" />
        <StatTile label="Not on GitHub" value={notOnGithub} href="/admin/build" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
        {/* Top open items */}
        <DashWidget title="Top open items" action={<Link href="/admin/build" className="text-sm text-[var(--color-gold)] hover:underline">Open board →</Link>}>
          <TimelineList items={topItems.map(toItem)} empty="Nothing open — the board is clear." />
        </DashWidget>

        {/* Quick links */}
        <DashWidget title="Quick links">
          <div className="space-y-2">
            {links.filter((l) => l.show).map((l) => (
              <Link
                key={l.href}
                href={l.href}
                {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--color-line)] px-4 py-3 text-sm text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-bone)] hover:text-[var(--color-ink)]"
              >
                <span>{l.label}</span>
                <span aria-hidden className="text-[var(--color-stone-soft)]">{l.external ? '↗' : '→'}</span>
              </Link>
            ))}
          </div>
        </DashWidget>
      </div>

      {/* Error reports */}
      <DashWidget title="Error reports" eyebrow="Newest first" action={<Link href="/admin/build" className="text-sm text-[var(--color-gold)] hover:underline">All issues →</Link>}>
        <TimelineList
          items={errors.map((e) => ({
            id: e.id,
            lead: <span aria-hidden className="text-base">⚠</span>,
            title: e.title,
            meta: [e.ref, e.reportedBy, new Date(e.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })].filter(Boolean).join(' · '),
            href: '/admin/build',
            trailing: <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${URGENCY_CLS[e.urgency] ?? URGENCY_CLS.P2}`}>{e.urgency}</span>,
          }))}
          empty="No open error reports. 🎉"
        />
      </DashWidget>
    </div>
  );
}
