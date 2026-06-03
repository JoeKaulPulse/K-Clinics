import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/ui/PageHero';
import { AcademyAuth } from '@/components/academy/AcademyAuth';
import { AcademyLogout } from '@/components/academy/AcademyLogout';
import { GuideHost } from '@/components/guide/GuideHost';
import { ACCREDITATION_LABELS } from '@/lib/academy';
import { pageMeta } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMeta({ title: 'Trainee Portal — K Academy', description: 'K Academy trainee portal — your courses, theory and practical dates.', path: '/academy/portal' });
export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = { APPLIED: 'Application received', OFFERED: 'Place offered', PAID: 'Paid', ENROLLED: 'Enrolled', COMPLETED: 'Completed', CANCELLED: 'Cancelled' };
const fmtDate = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
const fmtTime = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const ACTIVE = ['PAID', 'ENROLLED', 'COMPLETED'];

export default async function AcademyPortalPage() {
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);

  if (!student) {
    return (
      <>
        <PageHero eyebrow="K Academy" title="Trainee portal" lede="Sign in to track your enrolment, work through your theory and see your practical dates." gradient={['#2a2420', '#7b6a5d']} />
        <section className="container-lux section"><AcademyAuth /></section>
      </>
    );
  }

  const { db } = await import('@/lib/db');
  const { courseProgress, getStudentCalendar } = await import('@/lib/lms');
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

  return (
    <>
      <PageHero eyebrow="K Academy" title={`Welcome, ${student.firstName}.`} lede="Your training, in one place." gradient={['#2a2420', '#7b6a5d']} />
      <section className="container-lux section" data-tour="academy-courses">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-title">Your courses</h2>
          <AcademyLogout />
        </div>

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
              return (
                <div key={e.id} className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-6">
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
                  {e.course.accreditations.length > 0 && <p className="mt-3 text-[0.7rem] uppercase tracking-wide text-[var(--color-stone-soft)]">{e.course.accreditations.map((a) => ACCREDITATION_LABELS[a] ?? a).join(' · ')}</p>}
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
      <GuideHost />
    </>
  );
}
