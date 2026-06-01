import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/ui/PageHero';
import { AcademyAuth } from '@/components/academy/AcademyAuth';
import { AcademyLogout } from '@/components/academy/AcademyLogout';
import { ACCREDITATION_LABELS } from '@/lib/academy';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta({ title: 'Trainee Portal — K Academy', description: 'K Academy trainee portal — your courses, theory and practical dates.', path: '/academy/portal' });
export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = { APPLIED: 'Application received', OFFERED: 'Place offered', PAID: 'Paid', ENROLLED: 'Enrolled', COMPLETED: 'Completed', CANCELLED: 'Cancelled' };
const fmt = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });

export default async function AcademyPortalPage() {
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);

  if (!student) {
    return (
      <>
        <PageHero eyebrow="K Academy" title="Trainee portal" lede="Sign in to track your enrolment, access your theory and see your practical dates." gradient={['#2a2420', '#7b6a5d']} />
        <section className="container-lux section"><AcademyAuth /></section>
      </>
    );
  }

  const { db } = await import('@/lib/db');
  const enrolments = await db.enrolment.findMany({
    where: { studentId: student.id },
    orderBy: { createdAt: 'desc' },
    include: { course: true, cohort: true },
  });

  return (
    <>
      <PageHero eyebrow="K Academy" title={`Welcome, ${student.firstName}.`} lede="Your training, in one place." gradient={['#2a2420', '#7b6a5d']} />
      <section className="container-lux section">
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
            {enrolments.map((e) => (
              <div key={e.id} className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    {e.course.level && <span className="text-xs uppercase tracking-[0.16em] text-[var(--color-gold)]">{e.course.level}</span>}
                    <h3 className="font-[family-name:var(--font-display)] text-xl">{e.course.title}</h3>
                    <p className="mt-1 text-sm text-[var(--color-stone)]">{STATUS_LABEL[e.status] ?? e.status}{e.cohort ? ` · practical from ${fmt(e.cohort.startAt)}` : ''}</p>
                  </div>
                  {e.course.thinkificUrl && (e.status === 'PAID' || e.status === 'ENROLLED' || e.status === 'COMPLETED') && (
                    <a href={e.course.thinkificUrl} target="_blank" rel="noopener" className="rounded-full bg-[var(--color-gold)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--color-ink)]">Open theory (Thinkific) →</a>
                  )}
                </div>
                <div className="mt-4 grid gap-3 text-sm text-[var(--color-ink-soft)] sm:grid-cols-3">
                  <div className="rounded-[var(--radius-sm)] bg-[var(--color-porcelain)] px-4 py-3"><span className="block text-xs uppercase tracking-wide text-[var(--color-stone)]">Theory</span>{e.course.thinkificUrl ? 'Online via Thinkific' : 'Provided on enrolment'}</div>
                  <div className="rounded-[var(--radius-sm)] bg-[var(--color-porcelain)] px-4 py-3"><span className="block text-xs uppercase tracking-wide text-[var(--color-stone)]">Practical</span>{e.cohort ? fmt(e.cohort.startAt) : 'To be scheduled'}</div>
                  <div className="rounded-[var(--radius-sm)] bg-[var(--color-porcelain)] px-4 py-3"><span className="block text-xs uppercase tracking-wide text-[var(--color-stone)]">Assessment</span>VTCT exam, administered in-house</div>
                </div>
                {e.course.accreditations.length > 0 && <p className="mt-3 text-[0.7rem] uppercase tracking-wide text-[var(--color-stone-soft)]">{e.course.accreditations.map((a) => ACCREDITATION_LABELS[a] ?? a).join(' · ')}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
