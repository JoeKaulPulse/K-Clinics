import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { AcademyPortalShell } from '@/components/academy/AcademyPortalShell';
import { PageTitle, Card } from '@/components/academy/ui';
import { BadgeIcon } from '@/components/academy/BadgeIcon';
import { pageMeta } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMeta({ title: 'Your progress — K Academy', description: 'Your own XP, level and badges as you work through the academy.', path: '/academy/leaderboard' });
export const dynamic = 'force-dynamic';

// Tetiana (privacy): trainees only ever see their OWN progress here — never other
// students' results, scores, ranks, badges or completion. The leaderboards that
// once listed peers by name + XP have been removed. Staff still see comparative
// standings in the admin academy area; this page is private to each trainee.
export default async function ProgressPage() {
  if (!crmEnabled) redirect('/academy');
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) redirect('/academy/portal');

  const g = await import('@/lib/academy-gamification');
  const { academyLevel } = await import('@/lib/academy-levels');
  const { db } = await import('@/lib/db');
  const [standing, timeAgg, lessonsDone] = await Promise.all([
    g.studentStanding(student.id),
    db.lessonProgress.aggregate({ where: { studentId: student.id }, _sum: { secondsSpent: true } }),
    db.lessonProgress.count({ where: { studentId: student.id } }),
  ]);
  const earned = new Set(standing.badges.map((b) => b.key));
  const lvl = academyLevel(standing.xp);
  const totalMin = Math.round((timeAgg._sum.secondsSpent ?? 0) / 60);
  const timeLabel = totalMin >= 60 ? `${Math.floor(totalMin / 60)}h ${totalMin % 60}m` : `${totalMin}m`;
  const stats: [string, string | number][] = [['XP', standing.xp.toLocaleString()], ['Badges', earned.size], ['Lessons done', lessonsDone], ['Time studied', timeLabel]];

  return (
    <AcademyPortalShell firstName={student.firstName}>
      <PageTitle lede="Earn XP for every lesson, assessment and practice set, and unlock badges as you go. This is your own progress — only you and your tutors can see it.">Your progress</PageTitle>

      {/* Your level + personal stats (private to this trainee) */}
      <Card className="grid gap-5 p-6 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="flex items-center gap-3">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--color-gold-deep)] font-[family-name:var(--font-display)] text-2xl text-white">{lvl.level}</span>
          <div>
            <p className="font-medium">{lvl.title}</p>
            <p className="text-xs text-[var(--color-stone)]">Level {lvl.level}{lvl.nextAt != null ? ` · ${(lvl.nextAt - standing.xp).toLocaleString()} XP to next` : ' · max level'}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:border-l sm:border-[var(--color-line)] sm:pl-6">
          {stats.map(([label, value]) => (
            <div key={label}><p className="font-[family-name:var(--font-display)] text-2xl text-[var(--color-ink)]">{value}</p><p className="text-xs uppercase tracking-wide text-[var(--color-stone)]">{label}</p></div>
          ))}
        </div>
      </Card>

      {/* Badges — earned vs still to unlock */}
      <Card className="mt-6 p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">Your badges</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {g.BADGES.map((b) => {
            const has = earned.has(b.key);
            return (
              <span key={b.key} title={`${b.name} — ${b.description}`} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${has ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/10 text-[var(--color-ink)]' : 'border-[var(--color-line)] text-[var(--color-stone)] opacity-60'}`}>
                <BadgeIcon name={b.icon} className={`h-3.5 w-3.5 ${has ? 'text-[var(--color-gold-deep)]' : 'text-[var(--color-stone)]'}`} /> {b.name}
              </span>
            );
          })}
        </div>
      </Card>
    </AcademyPortalShell>
  );
}
