import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { KMark, ClinicsWordmark } from '@/components/brand/marks';
import { AcademyPortalShell } from '@/components/academy/AcademyPortalShell';
import { PrintButton } from '@/components/academy/PrintButton';
import { ACCREDITATION_LABELS } from '@/lib/academy';
import { pageMeta } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMeta({ title: 'Certificate — K Academy', description: 'Your K Academy certificate of completion.', path: '/academy/learn/certificate', noindex: true }); // BLD-341: per-learner certificate — never index
export const dynamic = 'force-dynamic';

const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export default async function CertificatePage({ params }: { params: Promise<{ slug: string }> }) {
  if (!crmEnabled) redirect('/academy');
  const { slug } = await params;

  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) redirect('/academy/portal');

  const { getCourseLearning } = await import('@/lib/lms');
  const learning = await getCourseLearning(slug, student.id);
  if (!learning) redirect('/academy/portal');
  if (!learning.certificateEligible) redirect(`/academy/learn/${slug}`);

  const { db } = await import('@/lib/db');
  const course = await db.course.findFirst({ where: { slug }, select: { accreditations: true } });
  const name = [student.firstName, student.lastName].filter(Boolean).join(' ');
  // BLD-528: issue (or fetch) a stored, verifiable reference + date.
  const { issueCertificate } = await import('@/lib/lms');
  const cert = await issueCertificate(student.id, learning.course.id);
  const ref = cert?.ref ?? `KA-${slug.slice(0, 6).toUpperCase()}-${student.id.slice(-6).toUpperCase()}`;
  const issued = cert?.issuedAt ?? new Date();
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://kclinics.co.uk';
  const verifyUrl = `${base.replace(/^https?:\/\//, '')}/academy/verify/${ref}`;

  return (
    <AcademyPortalShell firstName={student.firstName}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center justify-between print:hidden">
          <Link href={`/academy/learn/${slug}`} className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">← Back to course</Link>
          <PrintButton />
        </div>

        {/* Certificate */}
        <div className="relative overflow-hidden rounded-[var(--radius-2xl)] border-2 border-[var(--color-gold)]/40 bg-[var(--color-porcelain)] p-10 text-center shadow-[var(--shadow-lift)] md:p-16">
          <div className="mx-auto flex flex-col items-center text-[var(--color-ink)]">
            <span className="block h-11 w-7"><KMark /></span>
            <span className="mt-3 block h-3 w-32"><ClinicsWordmark /></span>
            <span className="mt-2 text-[0.62rem] uppercase tracking-[0.34em] text-[var(--color-stone)]">Academy</span>
          </div>

          <p className="mt-9 text-xs uppercase tracking-[0.24em] text-[var(--color-stone)]">Certificate of completion</p>
          <p className="mt-6 text-sm text-[var(--color-stone)]">This is to certify that</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl text-gold-gradient md:text-5xl">{name}</h1>
          <p className="mt-5 text-sm text-[var(--color-stone)]">has successfully completed the theory assessments for</p>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl">{learning.course.title}</h2>
          {learning.course.level && <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--color-gold-deep)]">{learning.course.level}</p>}

          {course?.accreditations.length ? (
            <p className="mx-auto mt-6 max-w-md text-[0.7rem] uppercase tracking-[0.14em] text-[var(--color-stone)]">{course.accreditations.map((a) => ACCREDITATION_LABELS[a] ?? a).join(' · ')}</p>
          ) : null}

          <div className="mt-9 flex flex-wrap items-end justify-between gap-6 border-t border-[var(--color-line)] pt-6 text-left text-xs text-[var(--color-stone)]">
            <div><span className="block uppercase tracking-wide text-[var(--color-stone)]">Date</span><span className="text-[var(--color-ink)]">{fmt(issued)}</span></div>
            <div><span className="block uppercase tracking-wide text-[var(--color-stone)]">Reference</span><span className="font-[family-name:var(--font-mono,monospace)] text-[var(--color-ink)]">{ref}</span></div>
            <div className="text-right"><span className="block uppercase tracking-wide text-[var(--color-stone)]">Awarded by</span><span className="text-[var(--color-ink)]">K Academy, London</span></div>
          </div>
          <p className="mt-4 text-[0.62rem] uppercase tracking-[0.14em] text-[var(--color-stone)]">Verify at {verifyUrl}</p>
        </div>

        <p className="mt-5 text-center text-xs text-[var(--color-stone)] print:hidden">
          This certificate confirms completion of the online theory and assessments. Your full accredited qualification is issued on completion of the practical training and external assessment. Anyone can confirm it at <Link href={`/academy/verify/${ref}`} className="link-underline">{verifyUrl}</Link>.
        </p>
      </div>
    </AcademyPortalShell>
  );
}
