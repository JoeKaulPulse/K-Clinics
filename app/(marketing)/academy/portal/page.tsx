import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/ui/PageHero';
import { KMark, ClinicsWordmark } from '@/components/brand/marks';
import { AcademyAuth } from '@/components/academy/AcademyAuth';
import { AcademyPortalShell } from '@/components/academy/AcademyPortalShell';
import { DailyGoal } from '@/components/academy/DailyGoal';
import { InstallPrompt } from '@/components/academy/InstallPrompt';
import { OnboardingHost } from '@/components/onboarding/OnboardingHost';
import { ONBOARDING } from '@/lib/onboarding-steps';
import { ACCREDITATION_LABELS } from '@/lib/academy';
import { pageMeta } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMeta({ title: 'Trainee Portal — K Academy', description: 'K Academy trainee portal — your courses, theory and practical dates.', path: '/academy/portal', noindex: true }); // BLD-341: private portal — never index
export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = { APPLIED: 'Application received', OFFERED: 'Place offered', PAID: 'Paid', ENROLLED: 'Enrolled', COMPLETED: 'Completed', CANCELLED: 'Cancelled' };
const fmtDate = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
const fmtShort = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtTime = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const gbp = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}`;
const ACTIVE = ['PAID', 'ENROLLED', 'COMPLETED'];

export default async function AcademyPortalPage() {
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);

  if (!student) {
    // Signed-out sign-in screen. The marketing chrome is hidden on this route, so
    // we give it a minimal brand bar (mirrors the client portal's login page).
    return (
      <div className="min-h-screen">
        <div className="border-b border-[var(--color-line)] bg-[color-mix(in_oklab,var(--color-porcelain)_82%,transparent)] backdrop-blur-xl">
          <div className="mx-auto flex max-w-[88rem] items-center justify-between px-[var(--gutter)] py-4">
            <Link href="/academy" aria-label="K Academy" className="flex items-center gap-2.5 text-[var(--color-ink)]">
              <span className="block h-8 w-[1.25rem]"><KMark /></span>
              <span className="hidden h-[0.62rem] w-[5.5rem] sm:block"><ClinicsWordmark /></span>
              <span className="hidden text-[0.6rem] uppercase tracking-[0.28em] text-[var(--color-stone)] sm:block">Academy</span>
            </Link>
            <Link href="/academy" className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">← Back to courses</Link>
          </div>
        </div>
        <PageHero eyebrow="K Academy" title="Trainee portal" lede="Sign in to track your enrolment, work through your theory and see your practical dates." gradient={['#2a2420', '#7b6a5d']} />
        <section className="container-lux section"><AcademyAuth /></section>
      </div>
    );
  }

  const { db } = await import('@/lib/db');
  const sprof = await db.academyStudent.findUnique({ where: { id: student.id }, select: { onboardedAt: true, goals: true } });
  const acadOnb = sprof ? { pending: !sprof.onboardedAt, initial: { goals: sprof.goals ?? '' } } : null;
  const { courseProgress, getStudentCalendar } = await import('@/lib/lms');
  const { enrolmentMoney } = await import('@/lib/academy-payments');
  const enrolments = await db.enrolment.findMany({
    where: { studentId: student.id },
    orderBy: { createdAt: 'desc' },
    include: { course: true, cohort: true },
  });
  const calendar = await getStudentCalendar(student.id);
  const progress = new Map(
    await Promise.all(
      enrolments.filter((e) => ACTIVE.includes(e.status)).map(async (e) => [e.id, await courseProgress(student.id, e.courseId)] as const),
    ),
  );
  // Money view for enrolments that can be paid (offered) or still owe a balance.
  const money = new Map(
    await Promise.all(
      enrolments.filter((e) => ['OFFERED', 'PAID', 'ENROLLED', 'COMPLETED'].includes(e.status)).map(async (e) => [e.id, await enrolmentMoney(e.id)] as const),
    ),
  );

  const { studentStanding } = await import('@/lib/academy-gamification');
  const { academyLevel } = await import('@/lib/academy-levels');
  const { dailyStatus } = await import('@/lib/academy-daily');
  const [standing, timeAgg, daily] = await Promise.all([
    studentStanding(student.id),
    db.lessonProgress.aggregate({ where: { studentId: student.id }, _sum: { secondsSpent: true } }),
    dailyStatus(student.id),
  ]);
  const lvl = academyLevel(standing.xp);
  const totalMin = Math.round((timeAgg._sum.secondsSpent ?? 0) / 60);

  return (
    <AcademyPortalShell firstName={student.firstName}>
      <div className="mb-7">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-gold)]">K Academy</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl sm:text-4xl">Welcome, {student.firstName}.</h1>
        <p className="mt-1 text-[var(--color-stone)]">Your training, in one place.</p>
      </div>
      <section>
        <div className="grid gap-4 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--color-gold)] font-[family-name:var(--font-display)] text-xl text-white">{lvl.level}</span>
              <div>
                <p className="font-medium">{lvl.title}</p>
                <p className="text-xs text-[var(--color-stone)]">Level {lvl.level}{lvl.nextAt != null ? ` · ${(lvl.nextAt - standing.xp).toLocaleString()} XP to next` : ' · max'}</p>
              </div>
            </div>
            {[['XP', standing.xp.toLocaleString()], ['Badges', String(standing.badges.length)], ['Rank', `#${standing.rank}`], ['Time', totalMin >= 60 ? `${Math.floor(totalMin / 60)}h ${totalMin % 60}m` : `${totalMin}m`]].map(([label, value]) => (
              <div key={label}><p className="font-[family-name:var(--font-display)] text-2xl">{value}</p><p className="text-xs uppercase tracking-wide text-[var(--color-stone)]">{label}</p></div>
            ))}
            <div className="min-w-[160px] flex-1">
              <div className="mb-1 flex justify-between text-xs text-[var(--color-stone)]"><span>To next level</span><span>{lvl.pct}%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--color-line)]"><div className="h-full rounded-full bg-[var(--color-gold)] transition-[width] duration-500" style={{ width: `${lvl.pct}%` }} /></div>
            </div>
          </div>
        </div>
        <DailyGoal status={daily} />
        </div>
        <div className="mt-4 flex justify-center"><InstallPrompt /></div>
      </section>
      <section className="mt-10" data-tour="academy-courses">
        <h2 className="text-title mb-6">Your courses</h2>

        {enrolments.length === 0 ? (
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 text-center">
            <p className="text-[var(--color-stone)]">You’re not enrolled on a course yet.</p>
            <Link href="/academy" className="mt-3 inline-block link-underline font-medium text-[var(--color-ink)]">Browse courses →</Link>
          </div>
        ) : (
          <div className="space-y-5">
            {enrolments.map((e) => {
              const active = ACTIVE.includes(e.status);
              const prog = progress.get(e.id);
              const m = money.get(e.id);
              const offered = e.status === 'OFFERED';
              const owes = !!m && m.outstandingPence > 0;
              return (
                <div key={e.id} className={`rounded-[var(--radius-xl)] border bg-[var(--color-bone)] p-6 ${offered ? 'border-[var(--color-gold)]' : 'border-[var(--color-line)]'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      {e.course.level && <span className="text-xs uppercase tracking-[0.16em] text-[var(--color-gold)]">{e.course.level}</span>}
                      <h3 className="font-[family-name:var(--font-display)] text-xl">{e.course.title}</h3>
                      <p className="mt-1 text-sm text-[var(--color-stone)]">{STATUS_LABEL[e.status] ?? e.status}{e.cohort ? ` · practical from ${fmtDate(e.cohort.startAt)}` : ''}</p>
                    </div>
                    {active && prog?.hasContent && (
                      <Link href={`/academy/learn/${e.course.slug}`} className="rounded-full bg-[var(--color-gold)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--color-ink)]">
                        {prog.pct === 0 ? 'Start learning →' : prog.pct === 100 ? 'Review course →' : 'Continue learning →'}
                      </Link>
                    )}
                  </div>

                  {/* Offer: accept & pay to secure the place (BLD-528) */}
                  {offered && m && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-gold)]/40 bg-[var(--color-gold)]/8 p-4">
                      <div>
                        <p className="font-medium text-[var(--color-ink)]">Your place is ready — accept &amp; pay to secure it.</p>
                        <p className="text-sm text-[var(--color-stone)]">Course fee {gbp(m.feePence)}{m.depositPence ? ` · or a ${gbp(m.depositPence)} deposit to reserve` : ''}{e.offerExpiresAt ? ` · respond by ${fmtShort(e.offerExpiresAt.toISOString())}` : ''}</p>
                      </div>
                      <Link href={`/academy/pay/${e.id}`} className="rounded-full bg-[var(--color-gold)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--color-ink)]">Accept &amp; pay →</Link>
                    </div>
                  )}

                  {/* Outstanding balance on a part-paid enrolment */}
                  {active && owes && m && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
                      <div>
                        <p className="font-medium text-[var(--color-ink)]">Balance outstanding: {gbp(m.outstandingPence)}</p>
                        <p className="text-sm text-[var(--color-stone)]">{gbp(m.paidPence)} of {gbp(m.feePence)} paid{m.nextDue ? ` · next ${gbp(m.nextDue.amountPence)} due ${fmtShort(m.nextDue.dueAt)}` : ''}</p>
                      </div>
                      <Link href={`/academy/pay/${e.id}`} className="rounded-full border border-[var(--color-line)] px-5 py-2 text-sm font-medium hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]">Pay balance →</Link>
                    </div>
                  )}

                  {/* Progress bar */}
                  {active && prog?.hasContent && (
                    <div className="mt-4">
                      <div className="mb-1.5 flex items-center justify-between text-xs text-[var(--color-stone)]"><span>Theory progress</span><span className="font-medium text-[var(--color-ink)]">{prog.pct}%</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--color-line)]"><div className="h-full rounded-full bg-[var(--color-gold)] transition-[width] duration-500" style={{ width: `${prog.pct}%` }} /></div>
                    </div>
                  )}

                  <div className="mt-4 grid gap-3 text-sm text-[var(--color-ink-soft)] sm:grid-cols-3">
                    <div className="rounded-[var(--radius-sm)] bg-[var(--color-porcelain)] px-4 py-3"><span className="block text-xs uppercase tracking-wide text-[var(--color-stone)]">Theory</span>{active ? 'Online — in your portal' : 'Unlocks when your place is confirmed'}</div>
                    <div className="rounded-[var(--radius-sm)] bg-[var(--color-porcelain)] px-4 py-3"><span className="block text-xs uppercase tracking-wide text-[var(--color-stone)]">Practical</span>{e.cohort ? fmtDate(e.cohort.startAt) : 'To be scheduled'}</div>
                    <div className="rounded-[var(--radius-sm)] bg-[var(--color-porcelain)] px-4 py-3"><span className="block text-xs uppercase tracking-wide text-[var(--color-stone)]">Assessment</span>VTCT exam, administered in-house</div>
                  </div>
                  {e.course.accreditations.length > 0 && <p className="mt-3 text-[0.7rem] uppercase tracking-wide text-[var(--color-stone)]">{e.course.accreditations.map((a) => ACCREDITATION_LABELS[a] ?? a).join(' · ')}</p>}
                </div>
              );
            })}
          </div>
        )}

        {/* Calendar */}
        {calendar.length > 0 && (
          <div className="mt-12">
            <h2 className="text-title">Upcoming classes</h2>
            <p className="mt-1 text-sm text-[var(--color-stone)]">Your live online sessions and in-person practical dates.</p>
            <div className="mt-6 space-y-3">
              {calendar.map((ev) => {
                const soon = +ev.startAt - Date.now() < 36e5 && +ev.startAt - Date.now() > -36e5; // within ~1h
                return (
                  <div key={`${ev.kind}-${ev.id}`} className="flex flex-wrap items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--color-ink)] text-center text-[var(--color-porcelain)]">
                      <span className="text-[0.6rem] uppercase tracking-wide">{ev.startAt.toLocaleDateString('en-GB', { month: 'short' })}</span>
                      <span className="font-[family-name:var(--font-display)] text-xl leading-none">{ev.startAt.getDate()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {ev.title}
                        <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-wide ${ev.kind === 'live' ? 'bg-sky-100 text-sky-800' : 'bg-[var(--color-gold)]/15 text-[var(--color-ink)]'}`}>{ev.kind === 'live' ? 'Online · Google Meet' : 'In person'}</span>
                      </p>
                      <p className="text-sm text-[var(--color-stone)]">{ev.courseTitle}</p>
                      <p className="text-sm text-[var(--color-stone)]">{fmtDate(ev.startAt)} · {fmtTime(ev.startAt)}{ev.endAt ? `–${fmtTime(ev.endAt)}` : ''}{ev.location ? ` · ${ev.location}` : ''}{ev.trainer ? ` · ${ev.trainer}` : ''}</p>
                    </div>
                    {ev.kind === 'live' && ev.joinUrl && (
                      <a href={ev.joinUrl} target="_blank" rel="noopener noreferrer" className={`rounded-full px-5 py-2 text-sm font-medium ${soon ? 'bg-[var(--color-gold)] text-white hover:bg-[var(--color-ink)]' : 'border border-[var(--color-line)] text-[var(--color-ink)] hover:border-[var(--color-gold)]'}`}>Join{soon ? ' now' : ''} →</a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
      {acadOnb && <OnboardingHost pending={acadOnb.pending} title={ONBOARDING.academy.title} intro={ONBOARDING.academy.intro} steps={ONBOARDING.academy.steps} initial={acadOnb.initial} endpoint={ONBOARDING.academy.endpoint} />}
    </AcademyPortalShell>
  );
}
