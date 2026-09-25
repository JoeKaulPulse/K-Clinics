import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal } from '@/components/motion/Reveal';
import { academyPolicies } from '@/lib/academy-policies';
import { pageMeta, JsonLd, breadcrumbLd, itemListLd } from '@/lib/seo';

// K Academy centre policies hub: the learner-facing policy set an awarding
// organisation's External Quality Assurer expects a VTCT centre to publish.
// Each policy can be rewritten by the owner in Admin → Pages (a published CMS
// page at /academy/policies/<slug> replaces the code default).
export const generateMetadata = (): Promise<Metadata> => pageMeta({
  title: 'Centre Policies — Learner Policies | K Academy London',
  description: 'K Academy centre policies: malpractice, appeals, complaints, equality, safeguarding, reasonable adjustments, assessment and quality assurance, health and safety.',
  path: '/academy/policies',
});

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export default function AcademyPoliciesPage() {
  return (
    <>
      <JsonLd data={[
        breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Academy', path: '/academy' }, { name: 'Centre policies', path: '/academy/policies' }]),
        itemListLd('K Academy centre policies', academyPolicies.map((p) => ({ name: p.title, path: `/academy/policies/${p.slug}` }))),
      ]} />
      <PageHero
        eyebrow="K Academy · Centre policies"
        title="How we run the academy."
        lede="The policies that protect our learners, models and clients and keep our assessment fair. They apply to every K Academy course; clinic policies for treatments are published separately."
        gradient={['#2a2420', '#7b6a5d']}
      />

      <section className="container-lux section">
        <div className="grid gap-5 sm:grid-cols-2">
          {academyPolicies.map((p) => (
            <Reveal key={p.slug}>
              <Link href={`/academy/policies/${p.slug}`} className="group flex h-full flex-col rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-6 transition-colors hover:border-[var(--color-gold)]">
                <h2 className="font-[family-name:var(--font-display)] text-xl leading-tight group-hover:text-[var(--color-gold-deep)]">{p.title}</h2>
                <p className="mt-2 flex-1 text-sm text-[var(--color-ink-soft)]">{p.summary}</p>
                <p className="mt-4 text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">Version {p.version} · Reviewed {fmt(p.reviewed)}</p>
              </Link>
            </Reveal>
          ))}
        </div>
        <p className="mt-10 max-w-2xl text-sm text-[var(--color-stone)]">
          Clinic policies (privacy, cancellations and refunds, complaints about treatments, health and safety, accessibility) are published under{' '}
          <Link href="/info/privacy-policy" className="link-underline">Information</Link>. Questions about any policy: email support@kclinics.co.uk.
        </p>
      </section>
    </>
  );
}
