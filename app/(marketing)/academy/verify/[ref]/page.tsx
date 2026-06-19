import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/ui/PageHero';
import { ACCREDITATION_LABELS } from '@/lib/academy';
import { pageMeta } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMeta({ title: 'Verify a certificate — K Academy', description: 'Confirm the authenticity of a K Academy certificate.', path: '/academy/verify', noindex: true });
export const dynamic = 'force-dynamic';

const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

// BLD-528: public certificate verification. No auth — anyone with the reference
// can confirm a K Academy theory certificate is genuine.
export default async function VerifyCertificatePage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const { crmEnabled } = await import('@/lib/crm');
  const result = crmEnabled ? await (await import('@/lib/lms')).verifyCertificate(decodeURIComponent(ref)).catch(() => ({ ok: false as const })) : { ok: false as const };

  return (
    <>
      <PageHero eyebrow="K Academy" title="Certificate verification" lede="Confirm that a K Academy certificate is genuine." gradient={['#2a2420', '#7b6a5d']} />
      <section className="container-lux section max-w-2xl">
        {result.ok ? (
          <div className="rounded-[var(--radius-2xl)] border border-[var(--color-gold)]/40 bg-[var(--color-porcelain)] p-8 text-center">
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-emerald-700">✓ Genuine certificate</p>
            <p className="mt-6 text-sm text-[var(--color-stone)]">This certifies that</p>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl">{result.name}</h1>
            <p className="mt-4 text-sm text-[var(--color-stone)]">completed the online theory and assessments for</p>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl">{result.courseTitle}{result.level ? ` · ${result.level}` : ''}</h2>
            {result.accreditations.length > 0 && <p className="mt-3 text-[0.7rem] uppercase tracking-[0.14em] text-[var(--color-stone)]">{result.accreditations.map((a) => ACCREDITATION_LABELS[a] ?? a).join(' · ')}</p>}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 border-t border-[var(--color-line)] pt-5 text-sm">
              <div><span className="block text-xs uppercase tracking-wide text-[var(--color-stone)]">Issued</span>{fmt(result.issuedAt)}</div>
              <div><span className="block text-xs uppercase tracking-wide text-[var(--color-stone)]">Reference</span><span className="font-[family-name:var(--font-mono,monospace)]">{decodeURIComponent(ref).toUpperCase()}</span></div>
            </div>
            <p className="mt-5 text-xs text-[var(--color-stone)]">The full accredited qualification is issued on completion of the practical training and external assessment.</p>
          </div>
        ) : (
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 text-center">
            <p className="font-[family-name:var(--font-display)] text-xl">Certificate not found</p>
            <p className="mt-2 text-[var(--color-stone)]">We couldn’t verify a certificate with that reference. Check the reference and try again, or contact K Academy.</p>
            <Link href="/academy" className="mt-5 inline-block link-underline font-medium text-[var(--color-ink)]">K Academy →</Link>
          </div>
        )}
      </section>
    </>
  );
}
