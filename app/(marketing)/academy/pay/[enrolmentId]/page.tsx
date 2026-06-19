import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHero } from '@/components/ui/PageHero';
import { EnrolmentCheckout } from '@/components/academy/EnrolmentCheckout';
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
    <>
      <PageHero
        eyebrow={enrolment.course.level ? `K Academy · ${enrolment.course.level}` : 'K Academy'}
        title="Accept your place"
        lede={`Secure your place on ${enrolment.course.title}.`}
        gradient={['#2a2420', '#7b6a5d']}
      />
      <section className="container-lux section max-w-2xl">
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
    </>
  );
}
