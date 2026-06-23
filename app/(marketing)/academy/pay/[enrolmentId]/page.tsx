import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EnrolmentCheckout } from '@/components/academy/EnrolmentCheckout';
import { AcademyPortalShell } from '@/components/academy/AcademyPortalShell';
import { pageMeta } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMeta({ title: 'Accept your place — K Academy', description: 'Accept your offer and secure your place at K Academy.', path: '/academy/pay', noindex: true });
export const dynamic = 'force-dynamic';

export default async function AcademyPayPage({ params }: { params: Promise<{ enrolmentId: string }> }) {
  const { enrolmentId } = await params;
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) redirect(`/academy/portal?from=/academy/pay/${enrolmentId}`);

  const { db } = await import('@/lib/db');
  const enrolment = await db.enrolment.findFirst({
    where: { id: enrolmentId, studentId: student.id },
    select: { id: true, status: true, offerExpiresAt: true, course: { select: { title: true, slug: true, level: true } } },
  });
  if (!enrolment) redirect('/academy/portal');

  const { enrolmentMoney } = await import('@/lib/academy-payments');
  const money = await enrolmentMoney(enrolment.id);

  const blocked =
    enrolment.status === 'APPLIED'
      ? 'Your place hasn’t been confirmed yet. We’ll email you the moment it’s ready to pay.'
      : enrolment.status === 'CANCELLED'
        ? 'This enrolment has been cancelled. Please get in touch if you think this is a mistake.'
        : null;

  return (
    <AcademyPortalShell firstName={student.firstName}>
      <div className="mb-7">
        {enrolment.course.level && <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-gold)]">K Academy · {enrolment.course.level}</p>}
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl sm:text-4xl">{(enrolment.status === 'ENROLLED' || enrolment.status === 'PAID') && money && money.outstandingPence > 0 ? 'Pay your balance' : 'Accept your place'}</h1>
        <p className="mt-1 text-[var(--color-stone)]">Secure your place on {enrolment.course.title}.</p>
      </div>
      <section className="max-w-2xl">
        {blocked || !money ? (
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 text-center">
            <p className="text-[var(--color-stone)]">{blocked ?? 'We couldn’t load this enrolment.'}</p>
            <Link href="/academy/portal" className="mt-4 inline-block link-underline font-medium text-[var(--color-ink)]">Back to my portal →</Link>
          </div>
        ) : (
          <>
            <EnrolmentCheckout
              enrolmentId={enrolment.id}
              courseTitle={enrolment.course.title}
              courseSlug={enrolment.course.slug}
              feePence={money.feePence}
              paidPence={money.paidPence}
              outstandingPence={money.outstandingPence}
              depositPence={money.depositPence}
              hasPlan={money.hasPlan}
              instalments={money.payments.filter((p) => p.kind === 'INSTALMENT')}
            />
            <p className="mt-6 text-center text-sm text-[var(--color-stone)]"><Link href="/academy/portal" className="link-underline font-medium text-[var(--color-ink)]">← Back to my portal</Link></p>
          </>
        )}
      </section>
    </AcademyPortalShell>
  );
}
