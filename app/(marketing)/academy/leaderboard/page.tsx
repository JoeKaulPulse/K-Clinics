import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { AcademyPortalShell } from '@/components/academy/AcademyPortalShell';
import { PageTitle, SectionTitle, Card } from '@/components/academy/ui';
import { pageMeta } from '@/lib/seo';
import type { LeaderRow } from '@/lib/academy-gamification';

export const generateMetadata = (): Promise<Metadata> => pageMeta({ title: 'Leaderboard — K Academy', description: 'Your XP, badges and where you rank in the academy.', path: '/academy/leaderboard' });
export const dynamic = 'force-dynamic';

function Board({ title, rows, blurb }: { title: string; rows: LeaderRow[]; blurb?: string }) {
  return (
    <div>
      <SectionTitle sub={blurb}>{title}</SectionTitle>
      <ol className="space-y-1.5">
        {rows.length === 0 ? (
          <li className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] p-5 text-sm text-[var(--color-stone)]">No rankings yet — earn XP by completing lessons, passing assessments and practising.</li>
        ) : rows.map((r) => (
          <li key={r.studentId} className={`flex items-center gap-3 rounded-[var(--radius-lg)] border px-4 py-3 ${r.isMe ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/8' : 'border-[var(--color-line)] bg-[var(--color-porcelain)]'}`}>
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-semibold ${r.rank <= 3 ? 'bg-[var(--color-gold)] text-white' : 'bg-[var(--color-bone)] text-[var(--color-stone)]'}`}>{r.rank}</span>
            <span className="flex-1 text-sm font-medium">{r.name}{r.isMe && <span className="ml-1.5 text-xs text-[var(--color-gold)]">you</span>}</span>
            {r.badges > 0 && <span className="text-xs text-[var(--color-stone)]">🏅 {r.badges}</span>}
            <span className="tabular-nums text-sm font-semibold text-[var(--color-ink)]">{r.xp.toLocaleString()} XP</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default async function LeaderboardPage() {
  if (!crmEnabled) redirect('/academy');
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) redirect('/academy/portal');

  const g = await import('@/lib/academy-gamification');
  const cohortId = await g.studentCohortId(student.id);
  const [standing, allTime, cohort] = await Promise.all([
    g.studentStanding(student.id),
    g.allTimeLeaderboard({ limit: 20, meId: student.id }),
    cohortId ? g.cohortLeaderboard(cohortId, { meId: student.id }) : Promise.resolve([]),
  ]);
  const earned = new Set(standing.badges.map((b) => b.key));

  return (
    <AcademyPortalShell firstName={student.firstName}>
      <PageTitle lede="Earn XP for every lesson, assessment and practice set. Top performers each cohort go in the running for end-of-course prizes — and our annual winners may be offered a place on the team.">Leaderboard</PageTitle>

      {/* Your standing */}
      <Card className="grid gap-4 p-6 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="flex items-center gap-6">
          <div className="text-center"><p className="font-[family-name:var(--font-display)] text-4xl text-[var(--color-ink)]">{standing.xp.toLocaleString()}</p><p className="text-xs uppercase tracking-wide text-[var(--color-stone)]">XP</p></div>
          <div className="text-center"><p className="font-[family-name:var(--font-display)] text-4xl text-[var(--color-ink)]">#{standing.rank}</p><p className="text-xs uppercase tracking-wide text-[var(--color-stone)]">of {standing.total}</p></div>
        </div>
        <div className="sm:border-l sm:border-[var(--color-line)] sm:pl-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">Badges</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {g.BADGES.map((b) => {
              const has = earned.has(b.key);
              return (
                <span key={b.key} title={`${b.name} — ${b.description}`} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${has ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/10 text-[var(--color-ink)]' : 'border-[var(--color-line)] text-[var(--color-stone)] opacity-60'}`}>
                  <span className={has ? '' : 'grayscale'}>{b.icon}</span> {b.name}
                </span>
              );
            })}
          </div>
        </div>
      </Card>

      <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:items-start">
        {cohortId && <Board title="Your cohort" rows={cohort} blurb="How you stack up against the people you’re training with." />}
        <Board title="All-time" rows={allTime} blurb="The academy’s highest scorers across every cohort." />
      </div>
    </AcademyPortalShell>
  );
}
