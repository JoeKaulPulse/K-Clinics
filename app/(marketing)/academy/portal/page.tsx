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
import { PageTitle, SectionTitle, Card, Stat, Pill, ProgressBar, EmptyState, AButton, Eyebrow } from '@/components/academy/ui';
import { pageMeta } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMeta({ title: 'Trainee Portal — K Academy', description: 'K Academy trainee portal — your courses, theory and practical dates.', path: '/academy/portal', noindex: true }); // BLD-341: private portal — never index
export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = { APPLIED: 'Application received', OFFERED: 'Place offered', PAID: 'Paid', ENROLLED: 'Enrolled', COMPLETED: 'Completed', CANCELLED: 'Cancelled' };
const FUNDING_STATUS: Record<string, { label: string; tone: 'neutral' | 'info' | 'good' | 'gold' }> = {
  NEW: { label: 'Application received', tone: 'neutral' },
  REVIEWING: { label: 'Under review', tone: 'info' },
  REFERRED: { label: 'Referred to funding provider', tone: 'info' },
  APPROVED: { label: 'Approved', tone: 'good' },
  FUNDED: { label: 'Fully funded', tone: 'good' },
  DECLINED: { label: 'Not funded', tone: 'neutral' },
};
const fmtDate = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
const fmtShort = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtTime = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
// Module release date: "1 July" within this year, "1 July 2027" otherwise.
const fmtRelease = (iso: string) => { const d = new Date(iso); return d.toLocaleDateString('en-GB', d.getFullYear() === new Date().getFullYear() ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' }); };
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
  const { courseProgress, getStudentCalendar, getStudentSchedule } = await import('@/lib/lms');
  const { enrolmentMoney } = await import('@/lib/academy-payments');
  const enrolments = await db.enrolment.findMany({
    where: { studentId: student.id },
    orderBy: { createdAt: 'desc' },
    include: { course: true, cohort: true },
  });
  const calendar = await getStudentCalendar(student.id);
  // Content drip schedule — only surface courses that actually have something pending.
  const schedule = (await getStudentSchedule(student.id)).filter((s) => s.hasUpcoming);
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

  // Dashboard model: one "continue" target, and action items pulled out of the
  // course cards so they read as a clear "needs attention" list (Phase 1).
  const activeWithContent = enrolments.filter((e) => ACTIVE.includes(e.status) && progress.get(e.id)?.hasContent);
  const resume = activeWithContent.find((e) => { const p = progress.get(e.id)!.pct; return p > 0 && p < 100; })
    ?? activeWithContent.find((e) => progress.get(e.id)!.pct === 0)
    ?? activeWithContent[0]
    ?? null;
  const offers = enrolments.filter((e) => e.status === 'OFFERED' && money.get(e.id));
  const balances = enrolments.filter((e) => ACTIVE.includes(e.status) && (money.get(e.id)?.outstandingPence ?? 0) > 0);
  // BLD-741: surface funding application status — previously only visible to staff.
  const fundingApps = await db.fundingApplication.findMany({
    where: { studentId: student.id, status: { not: 'CLOSED' } },
    orderBy: { updatedAt: 'desc' },
    include: { course: { select: { title: true } } },
  });
  // Don't greet a brand-new trainee with a wall of zeroes — only show the
  // gamification snapshot once they're actually studying or have earned XP.
  const showGamification = activeWithContent.length > 0 || standing.xp > 0;

  return (
    <AcademyPortalShell firstName={student.firstName}>
      <PageTitle eyebrow="K Academy" lede="Your training, in one place.">Welcome, {student.firstName}.</PageTitle>

      {/* Primary action: pick up where you left off */}
      {resume && (() => {
        const rp = progress.get(resume.id)!;
        const label = rp.pct === 0 ? 'Ready to begin' : rp.pct === 100 ? 'Completed' : 'Continue learning';
        const cta = rp.pct === 0 ? 'Start learning' : rp.pct === 100 ? 'Review course' : 'Resume course';
        return (
          <Card accent tone="porcelain" className="mb-8 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <Eyebrow>{label}</Eyebrow>
              <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl">{resume.course.title}</h2>
              {rp.pct > 0 && <ProgressBar pct={rp.pct} label="Theory progress" className="mt-3 max-w-md" />}
            </div>
            <AButton href={`/academy/learn/${resume.course.slug}`} className="shrink-0">{cta} →</AButton>
          </Card>
        );
      })()}

      {/* Needs your attention: offers to accept + balances to pay */}
      {(offers.length > 0 || balances.length > 0) && (
        <section className="mb-8">
          <SectionTitle>Needs your attention</SectionTitle>
          <div className="space-y-3">
            {offers.map((e) => { const m = money.get(e.id)!; return (
              <Card key={e.id} accent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-[var(--color-ink)]">{e.course.title} — your place is ready</p>
                  <p className="text-sm text-[var(--color-stone)]">Course fee {gbp(m.feePence)}{m.depositPence ? ` · or a ${gbp(m.depositPence)} deposit to reserve` : ''}{e.offerExpiresAt ? ` · respond by ${fmtShort(e.offerExpiresAt.toISOString())}` : ''}</p>
                </div>
                <AButton href={`/academy/pay/${e.id}`} className="shrink-0">Accept &amp; pay →</AButton>
              </Card>
            ); })}
            {balances.map((e) => { const m = money.get(e.id)!; return (
              <Card key={e.id} tone="porcelain" className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-[var(--color-ink)]">{e.course.title} — balance {gbp(m.outstandingPence)}</p>
                  <p className="text-sm text-[var(--color-stone)]">{gbp(m.paidPence)} of {gbp(m.feePence)} paid{m.nextDue ? ` · next ${gbp(m.nextDue.amountPence)} due ${fmtShort(m.nextDue.dueAt)}` : ''}</p>
                </div>
                <AButton href={`/academy/pay/${e.id}`} variant="secondary" className="shrink-0">Pay balance →</AButton>
              </Card>
            ); })}
          </div>
        </section>
      )}

      {/* Funding application status (BLD-741) */}
      {fundingApps.length > 0 && (
        <section className="mb-8">
          <SectionTitle>Funding application</SectionTitle>
          <div className="space-y-3">
            {fundingApps.map((f) => {
              const st = FUNDING_STATUS[f.status] ?? { label: f.status, tone: 'neutral' as const };
              return (
                <Card key={f.id} tone="porcelain" className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="flex items-center gap-2 font-medium text-[var(--color-ink)]">
                      {f.course?.title ?? 'Funding application'}
                      <Pill tone={st.tone}>{st.label}</Pill>
                    </p>
                    <p className="text-sm text-[var(--color-stone)]">Updated {fmtShort(f.updatedAt.toISOString())}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Progress snapshot (secondary) + daily goal — hidden until they've begun */}
      {showGamification && (<>
      <section className="mb-10 grid gap-4 lg:grid-cols-[1fr_360px] lg:items-start">
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--color-gold-deep)] font-[family-name:var(--font-display)] text-xl text-white">{lvl.level}</span>
              <div>
                <p className="font-medium">{lvl.title}</p>
                <p className="text-xs text-[var(--color-stone)]">Level {lvl.level}{lvl.nextAt != null ? ` · ${(lvl.nextAt - standing.xp).toLocaleString()} XP to next` : ' · max'}</p>
              </div>
            </div>
            <Stat label="XP" value={standing.xp.toLocaleString()} />
            <Stat label="Badges" value={standing.badges.length} />
            <Stat label="Time" value={totalMin >= 60 ? `${Math.floor(totalMin / 60)}h ${totalMin % 60}m` : `${totalMin}m`} />
            <AButton href="/academy/leaderboard" variant="secondary" size="sm" className="ml-auto">View progress →</AButton>
          </div>
          <ProgressBar pct={lvl.pct} label="To next level" className="mt-4" />
        </Card>
        <DailyGoal status={daily} />
      </section>
      <div className="mb-10 flex justify-center"><InstallPrompt /></div>
      </>)}

      {/* Your courses — slim cards (offers/balances live in "Needs your attention") */}
      <section data-tour="academy-courses">
        <SectionTitle>Your courses</SectionTitle>
        {enrolments.length === 0 ? (
          <EmptyState title="You’re not enrolled on a course yet." action={<AButton href="/academy">Browse courses →</AButton>}>
            Browse our accredited courses to get started — your theory, practical dates and progress all live here once you’re enrolled.
          </EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {enrolments.map((e) => {
              const active = ACTIVE.includes(e.status);
              const prog = progress.get(e.id);
              return (
                <Card key={e.id} className="flex flex-col p-5">
                  <div className="flex-1">
                    {e.course.level && <Eyebrow>{e.course.level}</Eyebrow>}
                    <h3 className="mt-1 font-[family-name:var(--font-display)] text-lg">{e.course.title}</h3>
                    <p className="mt-1 text-sm text-[var(--color-stone)]">{STATUS_LABEL[e.status] ?? e.status}{e.cohort ? ` · practical ${fmtDate(e.cohort.startAt)}` : ''}</p>
                    {active && prog?.hasContent && <ProgressBar pct={prog.pct} label="Theory" className="mt-3" />}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {active && prog?.hasContent ? (
                      prog.pct === 100 ? (
                        <>
                          <AButton href={`/academy/learn/${e.course.slug}/certificate`} size="sm">Certificate</AButton>
                          <AButton href={`/academy/learn/${e.course.slug}`} variant="secondary" size="sm">Review →</AButton>
                        </>
                      ) : (
                        <AButton href={`/academy/learn/${e.course.slug}`} variant="secondary" size="sm">{prog.pct === 0 ? 'Start' : 'Continue'} →</AButton>
                      )
                    ) : e.status === 'OFFERED' ? (
                      <AButton href={`/academy/pay/${e.id}`} size="sm">Accept &amp; pay →</AButton>
                    ) : (
                      <span className="text-xs text-[var(--color-stone)]">{active ? 'Content coming soon' : 'Awaiting confirmation'}</span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Course schedule — when modules unlock (drip release) */}
      {schedule.length > 0 && (
        <section className="mt-10">
          <SectionTitle sub="When each part of your course becomes available. Anything marked “Available now” is ready to study; the rest unlocks on the date shown.">Course schedule</SectionTitle>
          <div className="space-y-4">
            {schedule.map((c) => (
              <Card key={c.courseId} className="p-5">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-[family-name:var(--font-display)] text-lg">{c.courseTitle}</h3>
                  <AButton href={`/academy/learn/${c.slug}`} variant="secondary" size="sm">Open course →</AButton>
                </div>
                <ol className="space-y-1.5">
                  {c.modules.map((m, i) => (
                    <li key={m.id} className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2.5">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--color-bone)] text-xs font-medium text-[var(--color-stone)]">{i + 1}</span>
                      <span className="flex-1 text-sm">{m.title}</span>
                      {m.releaseAt ? <Pill tone="neutral">Opens {fmtRelease(m.releaseAt)}</Pill> : <Pill tone="good">Available now</Pill>}
                    </li>
                  ))}
                </ol>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming classes */}
      {calendar.length > 0 && (
        <section className="mt-10">
          <SectionTitle sub="Your live online sessions and in-person practical dates.">Upcoming</SectionTitle>
          <div className="space-y-3">
            {calendar.map((ev) => {
              const soon = +ev.startAt - Date.now() < 36e5 && +ev.startAt - Date.now() > -36e5; // within ~1h
              return (
                <Card key={`${ev.kind}-${ev.id}`} tone="porcelain" className="flex flex-wrap items-center gap-4 p-4">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--color-ink)] text-center text-[var(--color-porcelain)]">
                    <span className="text-[0.6rem] uppercase tracking-wide">{ev.startAt.toLocaleDateString('en-GB', { month: 'short' })}</span>
                    <span className="font-[family-name:var(--font-display)] text-xl leading-none">{ev.startAt.getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {ev.title}
                      <Pill tone={ev.kind === 'live' ? 'info' : 'gold'}>{ev.kind === 'live' ? 'Online · Google Meet' : 'In person'}</Pill>
                    </p>
                    <p className="text-sm text-[var(--color-stone)]">{ev.courseTitle}</p>
                    <p className="text-sm text-[var(--color-stone)]">{fmtDate(ev.startAt)} · {fmtTime(ev.startAt)}{ev.endAt ? `–${fmtTime(ev.endAt)}` : ''}{ev.location ? ` · ${ev.location}` : ''}{ev.trainer ? ` · ${ev.trainer}` : ''}</p>
                  </div>
                  {ev.kind === 'live' && ev.joinUrl && (
                    <AButton href={ev.joinUrl} external variant={soon ? 'primary' : 'secondary'} className="shrink-0">Join{soon ? ' now' : ''} →</AButton>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      )}
      {acadOnb && <OnboardingHost pending={acadOnb.pending} title={ONBOARDING.academy.title} intro={ONBOARDING.academy.intro} steps={ONBOARDING.academy.steps} initial={acadOnb.initial} endpoint={ONBOARDING.academy.endpoint} waitForConsent />}
    </AcademyPortalShell>
  );
}
